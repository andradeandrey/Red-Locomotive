var Rect = require('./rect');
var UidRegistry = require('./uid-registry');

module.exports = QuadTree;

function QuadTree(size, maxLeafsPerNode, maxDepth, x, y) {
    var LeafUid = UidRegistry();
    var leafData = {};

    size = size || 4096;
    maxLeafsPerNode = maxLeafsPerNode || 4;
    maxDepth = maxDepth || 5;
    x = typeof x == 'number' ? x : -(size / 2);
    y = typeof y == 'number' ? y : -(size / 2);

    if(typeof size != 'number' || (size & (size - 1)) != 0) { throw new Error('Bad size. Must be to the power of by 2.'); }
    if(typeof maxLeafsPerNode != 'number' || maxLeafsPerNode < 1) { throw new Error('bad maxLeafsPerNode. Must be greater than 0.'); }
    if(typeof maxDepth != 'number' || maxDepth < 1) { throw new Error('bad maxDepth. Must be greater than 0.'); }

    var quadTree = Node(x, y, size, 0);

    var api = {};
    api.root = quadTree;
    api.insert = insert;
    api.get = get;
    api.remove = remove;
    return api;

    function Node(x, y, size, depth) {
        var node = Rect(x, y, size, size);
        node.leafs = [];
        node.depth = depth;
        return node;
    }

    function Leaf(data) {
        var leaf = Rect(data.x, data.y, data.width, data.height);
        leaf.uid = LeafUid(data.uid || data.id || '');
        leafData[leaf.uid] = data;
        return leaf;
    }

    function insert(data) {
        return insertLeaf(quadTree, Leaf(data));
    }

    function get(rect) {
        var leafs = getLeaf(quadTree, rect);
        var results = [];
        var uids = [];
        while(leafs[0]) {
            var leaf = leafs.shift();
            if(uids.indexOf(leaf.uid) == -1) {
                uids.push(leaf.uid);
                results.push(leafData[leaf.uid]);
            }
        }
        return results;
    }

    function remove(rect, data) {
        if(data != undefined) {
            var leafs = removeLeaf(quadTree, rect, filter);
        } else {
            var leafs = removeLeaf(quadTree, rect);
        }

        var uids = [];
        while(leafs[0]) {
            var leaf = leafs.shift();
            if(uids.indexOf(leaf.uid) == -1) {
                delete leafData[leaf.uid];
                LeafUid.clear(leaf.uid);
                uids.push(leaf.uid);
            }
        }

        function filter(leaf) {
            return leafData[leaf.uid] == data;
        }
    }

    function insertLeaf(node, leaf) {
        if(node.depth == 0 && !Rect.contains(quadTree, leaf)) {
            grow(leaf);
        } else if(node.leafs) {
            node.leafs.push(leaf);
            if(
                node.depth < maxDepth - 1 &&
                node.width > 2 &&
                node.leafs[maxLeafsPerNode - 1]
            ) {
                splitNode(node);
            }
        } else {
            var nodes = ['q0', 'q1', 'q2', 'q3'];
            while(nodes[0]) {
                var subNode = node[nodes.shift()];
                if(Rect.overlaps(subNode, leaf)) {
                    insertLeaf(subNode, leaf);
                }
            }
        }
    }

    function getLeaf(node, rect) {
        var leafs = [];

        if(node.leafs) {
            for(var iI = 0; iI < node.leafs.length; iI += 1) {
                if(Rect.overlaps(rect, node.leafs[iI])) {
                    leafs.push(node.leafs[iI]);
                }
            }
        } else {
            var nodes = ['q0', 'q1', 'q2', 'q3'];
            while(nodes[0]) {
                var subNode = node[nodes.shift()];
                if(Rect.overlaps(rect, subNode)) {
                    leafs = leafs.concat(getLeaf(subNode, rect));
                }
            }
        }

        return leafs;
    }

    function removeLeaf(node, rect, callback) {
        var leafs = [];

        if(node.leafs) {
            for(var iI = 0; iI < node.leafs.length; iI += 1) {
                if(Rect.overlaps(rect, node.leafs[iI])) {
                    if(callback != undefined && callback(node.leafs[iI]) == false) { continue; }
                    leafs.push(node.leafs.splice(iI, 1));
                    iI -= 1;
                }
            }
        } else {
            var nodes = ['q0', 'q1', 'q2', 'q3'];
            var empty = true;
            while(nodes[0]) {
                var subNode = node[nodes.shift()];
                if(Rect.overlaps(rect, subNode)) {
                    leafs = leafs.concat(removeLeaf(subNode, rect, callback));
                }
                if(empty && (!subNode.leafs || subNode.leafs[0])) {
                    empty = false;
                }
            }
            if(empty) { mergeNode(node); }
        }

        return leafs;
    }

    function splitNode(node) {
        var halfSize = node.width / 2;
        node.q0 = Node(node.x, node.y, halfSize, node.depth + 1);
        node.q1 = Node(node.x + halfSize, node.y, halfSize, node.depth + 1);
        node.q2 = Node(node.x, node.y + halfSize, halfSize, node.depth + 1);
        node.q3 = Node(node.x + halfSize, node.y + halfSize, halfSize, node.depth + 1);
        var leafs = node.leafs;
        delete node.leafs;
        while(leafs[0]) { insertLeaf(node, leafs.shift()); }
    }

    function mergeNode(node) {
        delete node.q0;
        delete node.q1;
        delete node.q2;
        delete node.q3;
        node.leafs = [];
    }

    function grow(leaf) {
        //TODO: compute the new size rather than taking stabs at it.
        var newSize = quadTree.width * 2;
        var leafs = getLeaf(quadTree, quadTree);
        if(leaf.cy < quadTree.cy) {
            if(leaf.cx < quadTree.cx) {
                var x = quadTree.x - quadTree.width;
                var y = quadTree.y - quadTree.width;
            } else {
                var x = quadTree.x;
                var y = quadTree.y - quadTree.width;
            }
        } else {
            if(leaf.cx < quadTree.cx) {
                var x = quadTree.x - quadTree.width;
                var y = quadTree.y;
            } else {
                var x = quadTree.x;
                var y = quadTree.y;
            }
        }
        api.root = quadTree = Node(x, y, newSize, 0);
        while(leafs[0]) { insertLeaf(quadTree, leafs.shift()); }
        insertLeaf(quadTree, leaf);
    }
}
