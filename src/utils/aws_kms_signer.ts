import {
    GetPublicKeyCommand,
    KMSClient,
    SignCommand,
} from "@aws-sdk/client-kms";
import type { Deferrable } from "@ethersproject/properties";
import { type UnsignedTransaction, serialize } from "@ethersproject/transactions";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnConvert } from "@peculiar/asn1-schema";
import { SubjectPublicKeyInfo } from "@peculiar/asn1-x509";
import {
    ethers,
    getBytes,
    keccak256,
    toBeHex,
    toBigInt,
    N as secp256k1N,
    recoverAddress as recoverAddressFn,
    Signature,
} from "ethers";

export class AwsKmsSigner extends ethers.AbstractSigner {
    private address?: string;
    private pubkey?: string;

    private readonly client: () => KMSClient;
    private readonly keyId: string;
    private readonly region: string;
    constructor(region: string, keyId: string, provider?: ethers.Provider) {
        super(provider);

        this.client = () => new KMSClient({ region });
        this.keyId = keyId;
        this.region = region;
    }

    async getAddress(): Promise<string> {
        if (!this.address) {
            this.address = await this.getPubkey();
        }

        return this.address;
    }

    signMessage(message: string | ethers.BytesLike): Promise<string> {
        return this.signDigest(ethers.hashMessage(message));
    }

    async signTransaction(
        tx: Deferrable<ethers.TransactionRequest>,
    ): Promise<string> {
        const resolved = await ethers.resolveProperties(tx);
        if (resolved.from !== undefined) {
            const address = await this.getAddress();
            if (resolved.from !== address) {
                throw new Error(
                    `from address is ${resolved.from}, expected ${address}`,
                );
            }
        }
        const signature = await this.signDigest(
            ethers.keccak256(serialize(tx as UnsignedTransaction)),
        );
        return serialize(tx as UnsignedTransaction, signature);
    }

    async signTypedData(
        domain: ethers.TypedDataDomain,
        types: Record<string, Array<ethers.TypedDataField>>,
        value: Record<string, unknown>,
    ): Promise<string> {
        const resolved = await ethers.TypedDataEncoder.resolveNames(
            domain,
            types,
            value,
            async (name) => {
                if (!this.provider) {
                    throw new Error(`unable to resolve ens name ${name}: no provider`);
                }

                const resolved = await this.provider.resolveName(name);
                if (!resolved) {
                    throw new Error(`unable to resolve ens name ${name}`);
                }

                return resolved;
            },
        );

        return this.signDigest(
            ethers.TypedDataEncoder.hash(resolved.domain, types, resolved.value),
        );
    }

    connect(provider: ethers.Provider): ethers.Signer {
        return new AwsKmsSigner(this.region, this.keyId, provider);
    }

    private async getPubkey(): Promise<string> {
        if (!this.pubkey) {
            const { PublicKey, SigningAlgorithms } = await this.client().send(
                new GetPublicKeyCommand({ KeyId: this.keyId }),
            );
            const signingAlgorithm = SigningAlgorithms?.[0];
            if (signingAlgorithm !== "ECDSA_SHA_256") {
                throw new Error(
                    `algorithm is ${signingAlgorithm}, expected ECDSA_SHA_256`,
                );
            }
            if (!PublicKey) {
                throw new Error("missing public key pem");
            }

            const ecPublicKey = AsnConvert.parse(
                Buffer.from(PublicKey),
                SubjectPublicKeyInfo,
            ).subjectPublicKey;

            // Checksummed address
            const address = ethers.getAddress(
                `0x${keccak256(
                    new Uint8Array(ecPublicKey.slice(1, ecPublicKey.byteLength)),
                ).slice(-40)}`,
            );

            return address;
        }

        return this.pubkey;
    }

    private async signDigest(digest: ethers.BytesLike): Promise<string> {
        const command = new SignCommand({
            KeyId: this.keyId,
            Message: getBytes(digest),
            MessageType: "DIGEST",
            SigningAlgorithm: "ECDSA_SHA_256",
        });

        const response = await this.client().send(command);
        const signatureHex = response.Signature;
        if (!(signatureHex instanceof Uint8Array)) {
            throw new Error(
                `signature is ${typeof signatureHex}, expected Uint8Array`,
            );
        }

        const signature = AsnConvert.parse(
            Buffer.from(signatureHex),
            ECDSASigValue,
        );

        let s = toBigInt(new Uint8Array(signature.s));
        s = s > secp256k1N / BigInt(2) ? secp256k1N - s : s;

        const recoverAddress = recoverAddressFn(digest, {
            r: toBeHex(toBigInt(new Uint8Array(signature.r)), 32),
            s: toBeHex(s, 32),
            v: 0x1b,
        });

        const address = await this.getAddress();

        return Signature.from({
            r: toBeHex(toBigInt(new Uint8Array(signature.r)), 32),
            s: toBeHex(s, 32),
            v: recoverAddress.toLowerCase() !== address.toLowerCase() ? 0x1c : 0x1b,
        }).serialized;
    }
}