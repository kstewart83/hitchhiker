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
`[-][x][x][-] [0.0.2]` Serialize/Deserialize nodes <br/>
`[-][x][x][-] [0.0.2]` Create interface abstraction between tree operations and storage operations <br/>
`[-][x][x][-] [0.0.2]` Create in-memory implementation of storage abstraction <br/>
`[-][x][x][o] [0.0.2]` Externalize leaf node data structures <br/>
`[-][x][x][o] [0.0.2]` Externalize internal node data structures <br/>
`[-][x][o][x] [0.0.1]` Get basic project structure in place <br/>
`[-][x][x][x] [0.0.1]` Get basic B+ tree working with in memory allocations <br/>

`[ ][ ][ ][ ]` Create on-disk implementation of storage abstraction (can use DB library) <br/>
`[ ][ ][ ][ ]` Create DynamoDB implementation of storage abstraction <br/>
`[ ][ ][ ][ ]` Support `delete` operation <br/>
`[ ][ ][ ][ ]` Implement copy-on-write <br/>
`[ ][ ][ ][ ]` Allow for arbitrary external identifiers <br/>
