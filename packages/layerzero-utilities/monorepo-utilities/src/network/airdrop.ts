import { BigNumberish, ethers } from 'ethers'

/**
 * evm airdrop from signer
 * @param signer
 * @param toAddress
 * @param value
 */
export async function evmAirdrop(signer: ethers.Signer, toAddress: string, value: BigNumberish) {
    return await signer.sendTransaction({ to: toAddress, value: value }).then((tx) => tx.wait())
}

/**
 * get the airdrop signer, will return index 0 signer of a provider
 * @param provider
 */
export function getAirdropSigner(provider: any): ethers.Signer {
    if (typeof provider['getSigner'] === 'function') {
        return provider.getSigner(0)
    }
    throw new Error('provider does not have getSigner')
}
