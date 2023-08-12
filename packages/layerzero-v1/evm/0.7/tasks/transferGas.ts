module.exports = async function (taskArgs, hre) {
    const qty = hre.ethers.utils.parseEther(taskArgs.qty)
    const signers = await hre.ethers.getSigners()
    console.log(`sending from: ${signers[0].address}`)

    let currBalance = await hre.ethers.provider.getBalance(signers[taskArgs.i].address)
    console.log(
        `current balance ${signers[taskArgs.i].address}: ${currBalance.toString()} | ${hre.ethers.utils.formatEther(
            currBalance.toString()
        )}`
    )

    console.log(`sending ${qty} TO: ${signers[taskArgs.i].address}`)
    const tx = await (
        await signers[0].sendTransaction({
            to: signers[taskArgs.i].address,
            value: qty.toString(),
        })
    ).wait()
    console.log(`tx: ${tx.transactionHash}`)

    currBalance = await hre.ethers.provider.getBalance(signers[taskArgs.i].address)
    console.log(
        `updated balance ${signers[taskArgs.i].address}: ${currBalance.toString()} | ${hre.ethers.utils.formatEther(
            currBalance.toString()
        )}`
    )
}
