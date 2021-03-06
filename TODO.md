# TODO

This document tracks the goals and tasks for each major and minor release of this package. Tasks have four subtasks that need to be accomplished before the task is considered complete: model, implementation, tests, documentation.

- `-` Not currently executed for this task (deferring)
- `o` Not applicable to this task
- `x` Task complete

## 0.0.X

### Goals

- Get basic B+ tree version off the ground
- Implement storage abstraction
- Implement basic storage implementations

### Tasks

`.M--I--T--D.` <br/>
`[-][x][x][-] [0.0.4]` Enable storage driver to re-allocated freed pages <br/>
`[-][x][x][-] [0.0.4]` Make storage interface methods async <br/>
`[-][x][x][-] [0.0.4]` Create DynamoDB implementation of storage abstraction <br/>

`[-][x][x][-] [0.0.3]` Support `delete` operation <br/>
`[-][x][x][-] [0.0.3]` Use serialized node length for splitting/joining versus element number <br/>
`[-][x][x][-] [0.0.3]` Allow for arbitrary external identifiers <br/>

`[-][x][x][-] [0.0.2]` Serialize/Deserialize nodes <br/>
`[-][x][x][-] [0.0.2]` Create interface abstraction between tree operations and storage operations <br/>
`[-][x][x][-] [0.0.2]` Create in-memory implementation of storage abstraction <br/>
`[-][x][x][o] [0.0.2]` Externalize leaf node data structures <br/>
`[-][x][x][o] [0.0.2]` Externalize internal node data structures <br/>

`[-][x][o][x] [0.0.1]` Get basic project structure in place <br/>
`[-][x][x][x] [0.0.1]` Get basic B+ tree working with in memory allocations <br/>

`[ ][ ][ ][ ]` Create on-disk implementation of storage abstraction (can use DB library) <br/>
`[ ][ ][ ][ ]` Implement copy-on-write <br/>
`[ ][ ][ ][ ]` Use cryptographic hash of node contents as ID <br/>
`[ ][ ][ ][ ]` Create custom Node encoder/decoders for CBOR processor <br/>
`[ ][ ][ ][ ]` Transaction support <br/>
`[ ][ ][ ][ ]` Calculate estimated serialized length without serialization <br/>
`[ ][ ][ ][ ]` Move serialization of pages into storage driver <br/>
