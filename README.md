

# Ask/Bid matcher written in Typescript

The system consists of 4 services:
* receiver
* matcher
* processor
* transactionProcessor

## Receiver

Receiver exposes the web service, which accepts post requests on `/` url with the following format:
```
{
   "type": "buy",
   "price": 100,
   "amount": 1
}
```
and returns 
```
{ "received": "true" }
```
If message was queued.

Receiver places requests to AMQP fanout exchange, which is been read by `processor` and `matcher` services

## Matcher

Matcher receives messages from exchange and tries to match them with unmatched orders stored in in-memory `Binary Tree`. 
Binary tree has 2 indexes: `price` and `created_at` so that orders are first matched by price and then by date, so older orders are always processed first.
Matcher also sends all processed and updated order to amqp for `processor` and `transactionProcessor` services.

Matcher is also covered by tests which reside in `src/test/orderMatcher.test.ts`. Of the special interest is the `should bulk process` test, which creates 1000 buy orders and 1000 sell orders and matches the together.
On `Macbook Pro 2015 2.2Ghz i7` it takes 26ms to complete.
You can run it on the local machine with:
```jest src/test/orderMatcher.test.ts -t 'should bulk process'```

## Processor

Processor gets messages from Receiver and Matcher and performs bulk insert into `Postgres`. All the data been stored in storage is immutable, so it is possible to recover the state of orders in any time. There are no `update` queries, and the order state can be determined by the following fields:

`created_at` - new order

`updated_at` - order was partially closed

`closed_at`  - order was completed

## Transaction Persister

Transaction persister receives closed order transactions from `matcher` and puts them into database


# Setup

System uses `rabbitmq` for message queueing and `postgres` for data storage.
They can easily be installed and run with docker:
```
docker run -d -p 15672:15672 -p 5671:5671 -p 5672:5672 rabbitmq:3-management
docker run -e POSTGRES_PASSWORD=postgres -d -p 5432:5432 postgres
```

You might also have to modify default variables in dotenv configuration file `.env` in the project root

# Benchmarking and running

Before running services you need to have `knex` database migrations been run with
```
npm run migrate
```

Starting all services can be done with npm commands:
```
npm run start:receiver
npm run start:matcher
npm run start:processor
npm run start:transaction_persister
```

You can use `Apache Benchmark` to test web-endpoint performance, there are request fixtures provided for that:

```
ab -p fixtures/buy_order.json -T application/json -c 10 -n 2000 http://localhost:8080/
ab -p fixtures/buy_order.json -T application/json -c 10 -n 2000 http://localhost:8080/
```

# Develepoment
Project can be built to vanilla JS from Typescript with `npm run build`

All files are styled accoring to `AirBnb code styleguide` and checked with linter `ts-lint`. All files are checked with it on `build` stage.

Project is transpiled to vanilla JS from typescript with `npm run build`

Tests are run with:
`npm test`
