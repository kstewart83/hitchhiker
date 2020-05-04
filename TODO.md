# TODO

This document tracks the goals and tasks for each major and minor release of this package. Tasks have four subtasks that need to be accomplished before the task is considered complete: model, implementation, tests, documentation.

-: Not currently executed for this task (deferring)
o: Not applicable to this task
x: Task complete

## 0.0.X

### Goals

- Get basic B+ tree version off the ground
- Implement storage abstraction
- Implement basic storage implementations

### Tasks

.M--I--T--D.
[-][x][o][x] [0.0.1] Get basic project structure in place
[-][x][x][x] [0.0.1] Get basic B+ tree working with in memory allocations
[ ][ ][ ][ ] Externalize leaf node data structures
[ ][ ][ ][ ] Externalize internal node data structures
[ ][ ][ ][ ] Create interface abstraction between tree operations and storage operations
[ ][ ][ ][ ] Create in-memory implementation of storage abstraction
[ ][ ][ ][ ] Create on-disk implementation of storage abstraction (can use DB library)
[ ][ ][ ][ ] Create DynamoDB implementation of storage abstraction
