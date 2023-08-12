const { wireEndpoints, incrementCounterWithTestV2 } = require('../util/helpers');
const {
    generateEndpoints,
    generateVersion,
    getPairs,
    callAsContract,
    wireOmniCounters,
} = require('../../../0.7/utils/helpers');
const { VARS } = require('../../../0.7/utils/constants');

describe('ProfileV2:', function () {
    let chainIds = [1, 2, 3];
    let numOfIncrements = 10; // increase this to increase the scaling
    let unwiredEndpoints, wiredEndpoints;
    let { zroFee, outboundProofType2 } = VARS;
    let v2 = true;

    beforeEach(async function () {
        await deployments.fixture(['test']);

        const _endpoints = await generateEndpoints(chainIds);
        unwiredEndpoints = await Promise.all(
            _endpoints.map(async (endpoint, index) => {
                return await generateVersion(endpoint, chainIds, outboundProofType2, 1, true, v2, true);
            })
        );
        wiredEndpoints = await wireEndpoints(unwiredEndpoints, true, v2);
        await wireOmniCounters(wiredEndpoints, v2);

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
                await incrementCounterWithTestV2(wiredEndpoints[indexA], wiredEndpoints[indexB]);
            }
        }
    });
});
