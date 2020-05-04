# Hitchhiker

Hitchiker is a data structure layer to turn unordered stores (file system pages, DynamoDB) and present an ordered, copy-on-write key/value store abstraction based on the hitchiker tree. A hitchiker tree is write-optimized B+ tree that helps batch writes using a side-store in each node.

More information on hitchiker trees can be found [here](https://blog.datopia.io/2018/11/03/hitchhiker-tree/).
