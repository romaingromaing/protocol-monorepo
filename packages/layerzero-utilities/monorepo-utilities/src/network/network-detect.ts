export async function isHardhatNetwork(provider: any): Promise<boolean> {
    if (typeof provider['send'] === 'function') {
        try {
            const metadata = await provider.send('hardhat_metadata')
            if (metadata?.clientVersion?.startsWith('HardhatNetwork')) {
                return true
            }
        } catch (e) {
            // nothing
        }
    }
    return false
}
