const {
    generateEndpoints,
    generateVersion,
    getPairs,
    callAsContract,
    wireOmniCounters,
} = require('../../utils/helpers');
const { wireEndpoints, incrementCounterWithTest } = require('../util/helpers');
const { VARS } = require('../../utils/constants');

describe('Profile:', function () {
    let chainIds = [1, 2, 3];
    let numOfIncrements = 10; // increase this to increase the scaling
    let unwiredEndpoints, wiredEndpoints;
    let { zroFee, outboundProofType } = VARS;

    beforeEach(async function () {
        await deployments.fixture(['test']);

        const _endpoints = await generateEndpoints(chainIds);
        unwiredEndpoints = await Promise.all(
            _endpoints.map(async (endpoint, index) => {
                return await generateVersion(endpoint, chainIds, outboundProofType, 1);
            })
        );
        wiredEndpoints = await wireEndpoints(unwiredEndpoints);
        wireOmniCounters(wiredEndpoints);

        for (let e of wiredEndpoints) {
            // UA has ZRO to spend
            await e.lzToken.transfer(e.counterMock.address, zroFee * numOfIncrements * 2);
            // give ultraLightNode allowance to transfer ZRO on the UA behalf
            await callAsContract(e.lzToken, e.counterMock.address, 'approve(address,uint256)', [
                e.ultraLightNode.address,
                zroFee * numOfIncrements * 2,
            ]);
        }
    });

    it('incrementCounter() - nonces / counters', async function () {
        for (let i = 1; i <= numOfIncrements; i++) {
            for (let [indexA, indexB] of getPairs(chainIds.length)) {
                await incrementCounterWithTest(wiredEndpoints[indexA], wiredEndpoints[indexB]);
            }
        }
    });
});
