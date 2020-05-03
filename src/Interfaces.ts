export interface Node<K, V> {
  isLeaf?: boolean;
  parent?: Node<K, V>;
  children: Child<K, V>;
}

export interface Child<K, V> {
  key: K;
  value?: V;
  node?: Node<K, V>;
}
