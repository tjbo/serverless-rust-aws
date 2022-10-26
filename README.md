This Serverless Plugin packages your Rust binaries for deployment through the Serverless Framework to AWS Lambda. I went through about 3 repos and all were out of date or didn't work seemlessly.

Note: this has only been tested on Linux, but I will eventually test it on MacOS after my machine is repaired.

```service: serverless-rust-aws
frameworkVersion: '3'
configValidationMode: error
provider:
  name: aws
  memorySize: 128
  region: us-east-1
plugins:
  # this registers the plugin with serverless
  - ../src/index.js
  # - serverless-rust-aws - uncomment this when installing from npm
package:
  individually: true

functions:
  hello_world:
    # paths to your rust binary {projectDir}.{projectBinary}
    handler: hello_world.hello_world
    runtime: provided.al2 # needed to run on aws
    tags:
      rust: true # our script needs to know what functions to package
```
