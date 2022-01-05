"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var clear_1 = __importDefault(require("clear"));
var figlet_1 = __importDefault(require("figlet"));
var annelein_inquirer_1 = require("./annelein_inquirer");
var send_message_1 = require("./send_message");
var inquirer_1 = __importDefault(require("inquirer"));
var restart_1 = require("./restart");
var proof_request_1 = require("./proof_request");
var credential_1 = require("./credential");
var create_agent_1 = require("./create_agent");
var bc_coverin = "{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node1\",\"blskey\":\"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba\",\"blskey_pop\":\"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1\",\"client_ip\":\"138.197.138.255\",\"client_port\":9702,\"node_ip\":\"138.197.138.255\",\"node_port\":9701,\"services\":[\"VALIDATOR\"]},\"dest\":\"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv\"},\"metadata\":{\"from\":\"Th7MpTaRZVRYnPiabds81Y\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":1,\"txnId\":\"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node2\",\"blskey\":\"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk\",\"blskey_pop\":\"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5\",\"client_ip\":\"138.197.138.255\",\"client_port\":9704,\"node_ip\":\"138.197.138.255\",\"node_port\":9703,\"services\":[\"VALIDATOR\"]},\"dest\":\"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb\"},\"metadata\":{\"from\":\"EbP4aYNeTHL6q385GuVpRV\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":2,\"txnId\":\"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node3\",\"blskey\":\"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5\",\"blskey_pop\":\"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh\",\"client_ip\":\"138.197.138.255\",\"client_port\":9706,\"node_ip\":\"138.197.138.255\",\"node_port\":9705,\"services\":[\"VALIDATOR\"]},\"dest\":\"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya\"},\"metadata\":{\"from\":\"4cU41vWW82ArfxJxHkzXPG\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":3,\"txnId\":\"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node4\",\"blskey\":\"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw\",\"blskey_pop\":\"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP\",\"client_ip\":\"138.197.138.255\",\"client_port\":9708,\"node_ip\":\"138.197.138.255\",\"node_port\":9707,\"services\":[\"VALIDATOR\"]},\"dest\":\"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA\"},\"metadata\":{\"from\":\"TWwCRQRZ2ZHMJFn9TzLp7W\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":4,\"txnId\":\"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008\"},\"ver\":\"1\"}";
var connectionRecord;
var ui = new inquirer_1.default.ui.BottomBar();
var options;
(function (options) {
    options["Connection"] = "setup connection";
    options["Proof"] = "propose proof";
    options["Message"] = "send message";
    options["Exit"] = "exit";
    options["Restart"] = "restart";
})(options || (options = {}));
var Annelein = /** @class */ (function () {
    function Annelein(agent, connectionRecord, invitation) {
        var _this = this;
        this.process_prompt = function (annelein, answers) { return __awaiter(_this, void 0, void 0, function () {
            var _a, answer;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("error class?");
                        if (!(answers.options === options.Connection)) return [3 /*break*/, 2];
                        console.log('\nYour invitation link:\n', this.invitation.toUrl({ domain: 'http://localhost:9000' }), '\n');
                        console.log("Waiting for KLM to finish connection...");
                        _a = this;
                        return [4 /*yield*/, annelein.connections.returnWhenIsConnected(this.connectionRecord.id)];
                    case 1:
                        _a.connectionRecord = _b.sent();
                        (0, credential_1.accept_credential_offer)(annelein, this.connectionRecord);
                        console.log("\x1b[32m", "\nConnection established!\n", "\x1b[0m");
                        return [3 /*break*/, 9];
                    case 2:
                        if (!(answers.options == options.Proof)) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, proof_request_1.send_proof_proposal)(annelein, this.connectionRecord)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 4:
                        if (!(answers.options == options.Message)) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, send_message_1.send_message)(this.connectionRecord.id, annelein)];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 9];
                    case 6:
                        if (!(answers.options == options.Exit)) return [3 /*break*/, 7];
                        console.log("exiting...");
                        process.exit();
                        return [3 /*break*/, 9];
                    case 7:
                        if (!(answers.options == options.Restart)) return [3 /*break*/, 9];
                        return [4 /*yield*/, (0, restart_1.restart)(annelein)];
                    case 8:
                        _b.sent();
                        annelein.shutdown();
                        run_annelein();
                        return [2 /*return*/];
                    case 9: return [4 /*yield*/, (0, annelein_inquirer_1.annelein_inquirer)(annelein)];
                    case 10:
                        answer = _b.sent();
                        this.process_prompt(annelein, answer);
                        return [2 /*return*/];
                }
            });
        }); };
        this.agent = agent;
        this.connectionRecord = connectionRecord;
        this.invitation = invitation;
    }
    return Annelein;
}());
var run_annelein = function () { return __awaiter(void 0, void 0, void 0, function () {
    var agent, _a, invitation, connectionRecord, annelein, answer;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log("error main?");
                (0, clear_1.default)();
                console.log(figlet_1.default.textSync('Annelein', { horizontalLayout: 'full' }));
                return [4 /*yield*/, (0, create_agent_1.createAgent)('annelein', 9000, bc_coverin)];
            case 1:
                agent = _b.sent();
                console.log("\x1b[32m", 'Agent Annelein created', "\x1b[0m");
                return [4 /*yield*/, agent.connections.createConnection()];
            case 2:
                _a = _b.sent(), invitation = _a.invitation, connectionRecord = _a.connectionRecord;
                annelein = new Annelein(agent, connectionRecord, invitation);
                return [4 /*yield*/, (0, annelein_inquirer_1.annelein_inquirer)(annelein.agent)];
            case 3:
                answer = _b.sent();
                annelein.process_prompt(annelein.agent, answer);
                return [2 /*return*/];
        }
    });
}); };
console.log("error voor runnen?");
run_annelein();
