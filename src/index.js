'use strict'
const join = require('path').join
const process = require('process')
const { spawnSync } = require('child_process')
const AdmZip = require('adm-zip')
const { mkdirSync, writeFileSync, readFileSync } = require('fs')

class PluginError extends Error {
  constructor(message) {
    super(message)
    this.name = `ServerlessRustAWS Error: ${message}`
  }
}

class ServerlessRustAwsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.log = serverless.cli.log
    this.options = options
    this.targetRuntime = 'x86_64-unknown-linux-musl'
    this.hooks = {
      'before:package:createDeploymentArtifacts': () => this.build(),
    }

    // By default, Serverless examines node_modules to figure out which
    // packages there are from dependencies versus devDependencies of a
    // package. While there will always be a node_modules due to Serverless
    // and this plugin being installed, it will be excluded anyway.
    // Therefore, the filtering can be disabled to speed up (~3.2s) the process.
    this.serverless.service.package.excludeDevDependencies = false
  }

  async build() {
    if (this.serverless.service.provider.name !== 'aws') {
      throw new PluginError('This plugin only works with AWS.')
    }

    const buildFunctionPromises = this.serverless.service
      .getAllFunctions()
      .filter((fnName) => {
        return this.serverless.service.getFunction(fnName)['tags']['rust']
      })
      .map((fnName) => {
        return this.buildFunction(this.serverless.service.getFunction(fnName))
      })

    await Promise.all(buildFunctionPromises)
  }

  buildFunction(fn) {
    let { handler } = fn
    let [projectPath, projectName] = handler.split('.')
    let sourcePath = join(process.cwd(), projectPath)
    let buildResult = spawnSync(
      `cargo`,
      ['build', '--release', '--target', this.targetRuntime],
      {
        cwd: sourcePath,
        // inhert: 'stdio',
      },
    )

    if (buildResult.error || buildResult.status > 0) {
      return buildResult
    }

    const targetPath = join(
      sourcePath,
      'target',
      this.targetRuntime,
      'release',
      `${projectPath}`,
    )

    const zip = new AdmZip()

    zip.addFile('bootstrap', readFileSync(targetPath), '', 0o755)

    const artifactDir = join(
      process.cwd(),
      '.serverless',
      'target',
      'lambda',
      'release',
    )
    const artifactPath = join(artifactDir, `${projectName}.zip`)
    fn.package = fn.package || {}
    fn.package.artifact = artifactPath

    try {
      mkdirSync(artifactDir, { recursive: true })
    } catch {}
    try {
      writeFileSync(artifactPath, zip.toBuffer())
      return {}
    } catch (err) {
      this.serverless.cli.log(`Error zipping artifact ${err}`)
      return {
        err: err,
        status: 1,
      }
    }
  }
}

module.exports = ServerlessRustAwsPlugin
