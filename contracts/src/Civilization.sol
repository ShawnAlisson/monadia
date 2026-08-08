// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MonadiaCoin} from "./MonadiaCoin.sol";

/// @title MONADIA Civilization
/// @notice Shared on-chain economy for human and AI citizens on Monad.
contract Civilization {
    enum Resource {
        Food,
        Iron,
        Energy
    }

    enum BusinessType {
        Farm,
        Mine,
        PowerPlant
    }

    struct Citizen {
        string name;
        bool isAI;
        bool joined;
        uint256 reputation;
        uint8 occupation; // free-form code for UI
        address employer;
        uint256 hireRate;
    }

    struct Inventory {
        uint256 food;
        uint256 iron;
        uint256 energy;
    }

    struct Business {
        address owner;
        BusinessType businessType;
        string name;
        uint256 createdAt;
        bool active;
    }

    struct Proposal {
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool executed;
        bool active;
    }

    uint256 public constant FOOD = 0;
    uint256 public constant IRON = 1;
    uint256 public constant ENERGY = 2;

    // Prices in wei per unit (scaled as MON with 18 decimals)
    uint256 public foodPrice;
    uint256 public ironPrice;
    uint256 public energyPrice;

    // Civic token (MDA): welcome bonuses + trade tax
    MonadiaCoin public immutable token;
    uint256 public welcomeBonus = 100 ether; // 100 MDA
    uint256 public taxBps = 200; // 2% of trade value, paid in MDA
    uint256 public tokenTreasury; // MDA collected by the government

    uint256 public treasury;
    uint256 public totalTransactions;
    uint256 public aiTransactions;
    uint256 public humanTransactions;
    uint256 public economicEvents;
    uint256 public citizenCount;
    uint256 public aiCitizenCount;
    uint256 public humanCitizenCount;
    uint256 public businessCount;
    uint256 public proposalCount;

    mapping(address => Citizen) public citizens;
    mapping(address => Inventory) public inventories;
    mapping(uint256 => Business) public businesses;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public isRegisteredAI;

    address public operator;

    event CitizenJoined(address indexed citizen, string name, bool isAI);
    event ResourceBought(address indexed citizen, uint8 resourceId, uint256 amount, uint256 totalCost, bool isAI);
    event ResourceSold(address indexed citizen, uint8 resourceId, uint256 amount, uint256 totalRevenue, bool isAI);
    event BusinessCreated(uint256 indexed businessId, address indexed owner, uint8 businessType, string name);
    event AgentHired(address indexed employer, address indexed agent, uint256 dailyRate);
    event ProposalCreated(uint256 indexed proposalId, string description);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, bool isAI);
    event BusinessProduced(uint256 indexed businessId, uint8 resourceId, uint256 amount);
    event TransferResource(address indexed from, address indexed to, uint8 resourceId, uint256 amount);
    event WelcomeBonusGranted(address indexed citizen, uint256 amount);
    event TaxCollected(address indexed citizen, uint256 amount);
    event TaxRateChanged(uint256 newTaxBps);

    modifier onlyCitizen() {
        require(citizens[msg.sender].joined, "Not a citizen");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    constructor() {
        operator = msg.sender;
        foodPrice = 1 ether;
        ironPrice = 2 ether;
        energyPrice = 3 ether;
        token = new MonadiaCoin(address(this));
    }

    /// @notice Adjust the civic trade tax (governance execution). Max 10%.
    function setTaxBps(uint256 newTaxBps) external onlyOperator {
        require(newTaxBps <= 1000, "Max 10%");
        taxBps = newTaxBps;
        emit TaxRateChanged(newTaxBps);
    }

    function setOperator(address newOperator) external onlyOperator {
        operator = newOperator;
    }

    function registerAI(address agent, string calldata name, uint8 occupation) external onlyOperator {
        require(!citizens[agent].joined, "Already joined");
        citizens[agent] = Citizen({
            name: name,
            isAI: true,
            joined: true,
            reputation: 50,
            occupation: occupation,
            employer: address(0),
            hireRate: 0
        });
        isRegisteredAI[agent] = true;
        citizenCount++;
        aiCitizenCount++;
        _grantWelcome(agent);
        emit CitizenJoined(agent, name, true);
    }

    function joinCivilization(string calldata name) external {
        require(!citizens[msg.sender].joined, "Already joined");
        require(bytes(name).length > 0, "Name required");
        citizens[msg.sender] = Citizen({
            name: name,
            isAI: false,
            joined: true,
            reputation: 50,
            occupation: 0,
            employer: address(0),
            hireRate: 0
        });
        citizenCount++;
        humanCitizenCount++;
        _grantWelcome(msg.sender);
        _bumpTx(false);
        emit CitizenJoined(msg.sender, name, false);
    }

    function buyResource(uint8 resourceId, uint256 amount) external payable onlyCitizen {
        require(resourceId <= 2, "Invalid resource");
        require(amount > 0, "Amount required");
        uint256 price = _priceOf(resourceId);
        uint256 totalCost = price * amount;
        require(msg.value >= totalCost, "Insufficient MON");

        _addInventory(msg.sender, resourceId, amount);
        treasury += totalCost;
        _collectTax(msg.sender, totalCost);
        _nudgePriceUp(resourceId, amount);
        _bumpTx(citizens[msg.sender].isAI);
        economicEvents++;

        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit ResourceBought(msg.sender, resourceId, amount, totalCost, citizens[msg.sender].isAI);
    }

    function sellResource(uint8 resourceId, uint256 amount) external onlyCitizen {
        require(resourceId <= 2, "Invalid resource");
        require(amount > 0, "Amount required");
        require(_getInventory(msg.sender, resourceId) >= amount, "Insufficient inventory");

        uint256 price = _priceOf(resourceId);
        uint256 totalRevenue = price * amount;
        require(address(this).balance >= totalRevenue, "Market liquidity low");

        _subInventory(msg.sender, resourceId, amount);
        _nudgePriceDown(resourceId, amount);
        treasury = treasury > totalRevenue ? treasury - totalRevenue : 0;
        _collectTax(msg.sender, totalRevenue);
        _bumpTx(citizens[msg.sender].isAI);
        economicEvents++;

        payable(msg.sender).transfer(totalRevenue);
        emit ResourceSold(msg.sender, resourceId, amount, totalRevenue, citizens[msg.sender].isAI);
    }

    function createBusiness(uint8 businessType, string calldata name) external payable onlyCitizen {
        require(businessType <= 2, "Invalid business");
        require(msg.value >= 5 ether, "Need 5 MON stake");
        require(bytes(name).length > 0, "Name required");

        uint256 id = businessCount++;
        businesses[id] = Business({
            owner: msg.sender,
            businessType: BusinessType(businessType),
            name: name,
            createdAt: block.timestamp,
            active: true
        });
        treasury += msg.value;
        _bumpTx(citizens[msg.sender].isAI);
        economicEvents++;
        emit BusinessCreated(id, msg.sender, businessType, name);
    }

    function hireAgent(address agent, uint256 dailyRate) external payable onlyCitizen {
        require(citizens[agent].joined, "Agent not citizen");
        require(citizens[agent].isAI, "Not an AI agent");
        require(msg.value >= dailyRate, "Need first day payment");
        require(dailyRate > 0, "Rate required");

        citizens[agent].employer = msg.sender;
        citizens[agent].hireRate = dailyRate;
        treasury += msg.value;
        citizens[agent].reputation += 2;
        _bumpTx(false);
        economicEvents++;
        emit AgentHired(msg.sender, agent, dailyRate);
    }

    function createProposal(string calldata description, uint256 durationSeconds) external onlyOperator {
        uint256 id = proposalCount++;
        proposals[id] = Proposal({
            description: description,
            yesVotes: 0,
            noVotes: 0,
            deadline: block.timestamp + durationSeconds,
            executed: false,
            active: true
        });
        emit ProposalCreated(id, description);
    }

    function vote(uint256 proposalId, bool support) external onlyCitizen {
        Proposal storage p = proposals[proposalId];
        require(p.active, "Inactive");
        require(block.timestamp <= p.deadline, "Ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        hasVoted[proposalId][msg.sender] = true;
        if (support) p.yesVotes++;
        else p.noVotes++;

        citizens[msg.sender].reputation += 1;
        _bumpTx(citizens[msg.sender].isAI);
        economicEvents++;
        emit Voted(proposalId, msg.sender, support, citizens[msg.sender].isAI);
    }

    function produce(uint256 businessId) external onlyOperator {
        Business storage b = businesses[businessId];
        require(b.active, "Inactive business");
        uint8 resourceId;
        uint256 amount;
        if (b.businessType == BusinessType.Farm) {
            resourceId = 0;
            amount = 10;
        } else if (b.businessType == BusinessType.Mine) {
            resourceId = 1;
            amount = 5;
        } else {
            resourceId = 2;
            amount = 4;
        }
        _addInventory(b.owner, resourceId, amount);
        economicEvents++;
        emit BusinessProduced(businessId, resourceId, amount);
    }

    function transferResource(address to, uint8 resourceId, uint256 amount) external onlyCitizen {
        require(citizens[to].joined, "Recipient not citizen");
        require(_getInventory(msg.sender, resourceId) >= amount, "Insufficient");
        _subInventory(msg.sender, resourceId, amount);
        _addInventory(to, resourceId, amount);
        _bumpTx(citizens[msg.sender].isAI);
        emit TransferResource(msg.sender, to, resourceId, amount);
    }

    /// @notice Seed market liquidity so sells can settle.
    function fundMarket() external payable onlyOperator {
        treasury += msg.value;
    }

    function getPrices() external view returns (uint256, uint256, uint256) {
        return (foodPrice, ironPrice, energyPrice);
    }

    function getInventory(address citizen) external view returns (uint256, uint256, uint256) {
        Inventory memory inv = inventories[citizen];
        return (inv.food, inv.iron, inv.energy);
    }

    function getMetrics()
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return (
            totalTransactions,
            aiTransactions,
            humanTransactions,
            economicEvents,
            citizenCount,
            aiCitizenCount,
            humanCitizenCount
        );
    }

    function _priceOf(uint8 resourceId) internal view returns (uint256) {
        if (resourceId == 0) return foodPrice;
        if (resourceId == 1) return ironPrice;
        return energyPrice;
    }

    function _nudgePriceUp(uint8 resourceId, uint256 amount) internal {
        uint256 bump = (amount * 0.01 ether) / 10;
        if (bump == 0) bump = 0.001 ether;
        if (resourceId == 0) foodPrice += bump;
        else if (resourceId == 1) ironPrice += bump;
        else energyPrice += bump;
    }

    function _nudgePriceDown(uint8 resourceId, uint256 amount) internal {
        uint256 drop = (amount * 0.01 ether) / 10;
        if (drop == 0) drop = 0.001 ether;
        if (resourceId == 0) foodPrice = foodPrice > drop + 0.1 ether ? foodPrice - drop : 0.1 ether;
        else if (resourceId == 1) ironPrice = ironPrice > drop + 0.1 ether ? ironPrice - drop : 0.1 ether;
        else energyPrice = energyPrice > drop + 0.1 ether ? energyPrice - drop : 0.1 ether;
    }

    function _addInventory(address who, uint8 resourceId, uint256 amount) internal {
        if (resourceId == 0) inventories[who].food += amount;
        else if (resourceId == 1) inventories[who].iron += amount;
        else inventories[who].energy += amount;
    }

    function _subInventory(address who, uint8 resourceId, uint256 amount) internal {
        if (resourceId == 0) inventories[who].food -= amount;
        else if (resourceId == 1) inventories[who].iron -= amount;
        else inventories[who].energy -= amount;
    }

    function _getInventory(address who, uint8 resourceId) internal view returns (uint256) {
        if (resourceId == 0) return inventories[who].food;
        if (resourceId == 1) return inventories[who].iron;
        return inventories[who].energy;
    }

    function _grantWelcome(address who) internal {
        token.mint(who, welcomeBonus);
        emit WelcomeBonusGranted(who, welcomeBonus);
    }

    /// @dev Levy the civic tax in MDA on a trade's MON value (1 MDA per MON).
    ///      Never blocks the trade: if the citizen can't pay, the tax is waived.
    function _collectTax(address who, uint256 tradeValue) internal {
        uint256 tax = (tradeValue * taxBps) / 10000;
        if (tax == 0 || token.balanceOf(who) < tax) return;
        token.collectTax(who, tax);
        tokenTreasury += tax;
        emit TaxCollected(who, tax);
    }

    function _bumpTx(bool isAI) internal {
        totalTransactions++;
        if (isAI) aiTransactions++;
        else humanTransactions++;
    }

    receive() external payable {
        treasury += msg.value;
    }
}
