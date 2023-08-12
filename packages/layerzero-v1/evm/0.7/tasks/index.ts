import { task } from 'hardhat/config'

task('transferGas', 'transfer gas token from signer[0] to signer[x]', require('./transferGas'))
    .addParam('i', 'index of ethers.getSigners() to transfer to')
    .addParam('qty', 'the quantity, in decimal form (ie: 0.0134) to transfer')
