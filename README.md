# Hybrid-Cache

[![CircleCI](https://circleci.com/gh/enumatech/hybrid-cache.svg?style=svg)](https://circleci.com/gh/enumatech/hybrid-cache)

This NodeJS module implements a hybrid cache: a fast, in-process memory cache,
backed by Redis pub-sub for invalidation. Note that no data is actually being
stored in Redis.

In-memory caches are more efficient than Redis since no round-trip is necessary
to access the data. However, when data changes, each copy of the cached data in
all processes must be deleted, not just in the process that changes the data.
Hybrid Cache uses Redis pub-sub to notify all caches in all processes of these
data changes.

## Installation

```
nmp install @enumatech/hybrid-cache
```

## Running tests

```
npm install
npm test
```

# The MIT License
Copyright 2018 Enuma Technologies Limited.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
