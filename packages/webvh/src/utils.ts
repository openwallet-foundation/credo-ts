import * as CryptoJS from 'crypto-js'

export function HashData(data: string) {
    return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(data));
    // return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(data)).toString(CryptoJS.enc.Hex);
}