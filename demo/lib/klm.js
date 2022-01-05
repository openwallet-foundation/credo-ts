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
exports.accept_proof_proposal = exports.process_answer_klm = void 0;
var core_1 = require("@aries-framework/core");
var clear_1 = __importDefault(require("clear"));
var figlet_1 = __importDefault(require("figlet"));
var connection_1 = require("./connection");
var credential_1 = require("./credential");
var klm_inquirer_1 = require("./klm_inquirer");
var register_1 = require("./register");
var send_message_1 = require("./send_message");
var inquirer_1 = __importDefault(require("inquirer"));
var restart_1 = require("./restart");
var core_2 = require("@aries-framework/core");
var create_agent_1 = require("./create_agent");
var bc_coverin = "{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node1\",\"blskey\":\"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba\",\"blskey_pop\":\"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1\",\"client_ip\":\"138.197.138.255\",\"client_port\":9702,\"node_ip\":\"138.197.138.255\",\"node_port\":9701,\"services\":[\"VALIDATOR\"]},\"dest\":\"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv\"},\"metadata\":{\"from\":\"Th7MpTaRZVRYnPiabds81Y\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":1,\"txnId\":\"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node2\",\"blskey\":\"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk\",\"blskey_pop\":\"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5\",\"client_ip\":\"138.197.138.255\",\"client_port\":9704,\"node_ip\":\"138.197.138.255\",\"node_port\":9703,\"services\":[\"VALIDATOR\"]},\"dest\":\"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb\"},\"metadata\":{\"from\":\"EbP4aYNeTHL6q385GuVpRV\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":2,\"txnId\":\"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node3\",\"blskey\":\"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5\",\"blskey_pop\":\"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh\",\"client_ip\":\"138.197.138.255\",\"client_port\":9706,\"node_ip\":\"138.197.138.255\",\"node_port\":9705,\"services\":[\"VALIDATOR\"]},\"dest\":\"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya\"},\"metadata\":{\"from\":\"4cU41vWW82ArfxJxHkzXPG\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":3,\"txnId\":\"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4\"},\"ver\":\"1\"}\n{\"reqSignature\":{},\"txn\":{\"data\":{\"data\":{\"alias\":\"Node4\",\"blskey\":\"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw\",\"blskey_pop\":\"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP\",\"client_ip\":\"138.197.138.255\",\"client_port\":9708,\"node_ip\":\"138.197.138.255\",\"node_port\":9707,\"services\":[\"VALIDATOR\"]},\"dest\":\"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA\"},\"metadata\":{\"from\":\"TWwCRQRZ2ZHMJFn9TzLp7W\"},\"type\":\"0\"},\"txnMetadata\":{\"seqNo\":4,\"txnId\":\"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008\"},\"ver\":\"1\"}";
var options;
(function (options) {
    options["Connection"] = "setup connection";
    options["Credential"] = "offer credential";
    options["CredDef"] = "print credential definition";
    options["Message"] = "send message";
    options["Exit"] = "exit";
    options["Restart"] = "restart";
})(options || (options = {}));
var connectionRecord;
var credentialDefenition;
var ui = new inquirer_1.default.ui.BottomBar();
var process_answer_klm = function (klm, answers) { return __awaiter(void 0, void 0, void 0, function () {
    var check, answer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(answers.options === options.Connection)) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, connection_1.accept_connection)(klm)];
            case 1:
                connectionRecord = _a.sent();
                (0, exports.accept_proof_proposal)(klm);
                return [3 /*break*/, 15];
            case 2:
                if (!(answers.options == options.Credential)) return [3 /*break*/, 7];
                ui.log.write('\x1b[36mRegistering a schema...\x1b[0m');
                return [4 /*yield*/, (0, register_1.register_credential_schema)(klm)];
            case 3:
                credentialDefenition = _a.sent();
                if (!(connectionRecord !== undefined && credentialDefenition !== undefined)) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, credential_1.issue_credential)(klm, credentialDefenition.id, connectionRecord)];
            case 4:
                _a.sent();
                return [3 /*break*/, 6];
            case 5:
                ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a connection yet \x1b[0m");
                _a.label = 6;
            case 6: return [3 /*break*/, 15];
            case 7:
                if (!(answers.options == options.CredDef)) return [3 /*break*/, 8];
                console.log("creddef");
                if (credentialDefenition !== undefined) {
                    ui.log.write("\u001B[36m ".concat(credentialDefenition.id, " \u001B[0m"));
                }
                else {
                    ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a credential request? \x1b[0m");
                }
                return [3 /*break*/, 15];
            case 8:
                if (!(answers.options == options.Message)) return [3 /*break*/, 12];
                if (!(connectionRecord !== undefined)) return [3 /*break*/, 10];
                return [4 /*yield*/, (0, send_message_1.send_message)(connectionRecord.id, klm)];
            case 9:
                _a.sent();
                return [3 /*break*/, 11];
            case 10:
                ui.log.write("\x1b[31m Something went wrong.. Could it be that you have not set up a connection yet? \x1b[0m");
                _a.label = 11;
            case 11: return [3 /*break*/, 15];
            case 12:
                if (!(answers.options == options.Exit)) return [3 /*break*/, 13];
                process.exit();
                return [3 /*break*/, 15];
            case 13:
                if (!(answers.options == options.Restart)) return [3 /*break*/, 15];
                return [4 /*yield*/, (0, restart_1.restart)(klm)];
            case 14:
                check = _a.sent();
                if (check == true) {
                    klm.shutdown();
                    run_klm();
                    return [2 /*return*/];
                }
                _a.label = 15;
            case 15: return [4 /*yield*/, (0, klm_inquirer_1.klm_inquirer)(klm)];
            case 16:
                answer = _a.sent();
                (0, exports.process_answer_klm)(klm, answer);
                return [2 /*return*/];
        }
    });
}); };
exports.process_answer_klm = process_answer_klm;
var accept_proof_proposal = function (annelein) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        annelein.events.on(core_2.ProofEventTypes.ProofStateChanged, function (_a) {
            var payload = _a.payload;
            return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!(payload.proofRecord.state === core_1.ProofState.ProposalReceived)) return [3 /*break*/, 2];
                            return [4 /*yield*/, annelein.proofs.acceptProposal(payload.proofRecord.id)];
                        case 1:
                            _b.sent();
                            ui.log.write("\x1b[32m\nProof accepted!\n\x1b[0m");
                            _b.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        });
        return [2 /*return*/];
    });
}); };
exports.accept_proof_proposal = accept_proof_proposal;
var run_klm = function () { return __awaiter(void 0, void 0, void 0, function () {
    var klm, answer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, clear_1.default)();
                console.log(figlet_1.default.textSync('KLM', { horizontalLayout: 'full' }));
                return [4 /*yield*/, (0, create_agent_1.createAgent)('klm', 9001, bc_coverin)];
            case 1:
                klm = _a.sent();
                console.log("\x1b[32m", 'Agent KLM created', "\x1b[0m");
                return [4 /*yield*/, (0, klm_inquirer_1.klm_inquirer)(klm)];
            case 2:
                answer = _a.sent();
                (0, exports.process_answer_klm)(klm, answer);
                return [2 /*return*/];
        }
    });
}); };
run_klm();
