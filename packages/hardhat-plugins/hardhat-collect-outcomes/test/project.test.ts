// tslint:disable-next-line no-implicit-dependencies
import { assert } from 'chai'

import { ExampleHardhatRuntimeEnvironmentField } from '../src/ExampleHardhatRuntimeEnvironmentField'

import { useEnvironment } from './helpers'

describe('Integration tests examples', function () {
    describe('Hardhat Runtime Environment extension', function () {
        useEnvironment('hardhat-project')

        it('The example field should say hello', async function () {
            await this.hre.run('compile', { force: true })
            await this.hre.run('typechain')
            await this.hre.run('deploy', { write: true })
        })
    })
})

describe('Unit tests examples', function () {
    describe('ExampleHardhatRuntimeEnvironmentField', function () {
        describe('sayHello', function () {
            it('Should say hello', function () {
                const field = new ExampleHardhatRuntimeEnvironmentField()
                assert.equal(field.sayHello(), 'hello')
            })
        })
    })
})
