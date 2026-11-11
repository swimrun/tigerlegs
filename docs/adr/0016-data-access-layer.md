# 16. Data access layer: ORM or repositories, PostgreSQL driver, concurrency

Date: 2026-11-11

## Status

Draft. No decision has been taken; this record sets up the comparison for issue #71.
It follows [ADR-0014](./0014-back-end-technology.md) (Node.js with TypeScript) and sits next to the storage record of #63 (ADR-0015: PostgreSQL with PostGIS, backups, schema outline), which is about the database and not about how code talks to it.
The weights are the owner's to set; nothing here is scored yet.

## Context

The back end will hold aggregates such as a course (with variants and legs), a team or app group (with members), a swimrunner profile and a recording that refers to a course by id (ADR-0014, persistence section).
The owner works in Domain-Driven Design and knows Spring Data JDBC, so three things are requirements and not extras.

**Aggregates, in the DDD sense.** The term "aggregate" is used in other contexts, for example UML, where it is not the same concept as a DDD aggregate (Fowler, n.d.-b).
In the DDD sense an aggregate is a cluster of domain objects treated as a single unit, and "transactions should not cross aggregate boundaries" (Fowler, n.d.-b).
Concepts that have composition or aggregation relations in the model belong in one aggregate, with the owning concept as the aggregate root.
What goes into the aggregate follows from the invariants that must hold at all times, and for the others eventual consistency is allowed, to avoid blocking that the business does not need. That is a modelling decision for each aggregate, made in the domain model and not by the ORM.

**Optimistic concurrency.** When two users change the same aggregate, the first commit wins and the second gets an error instead of silently overwriting it (the owner knows this from Spring Data JDBC).
For an aggregate the check belongs on the root: a change to any child must conflict with another change to the same aggregate.

**A way to eventual consistency.** Between aggregates consistency is eventual, so a change in one aggregate may have to reach another reliably, for example through an outbox table written in the same transaction (not sourced yet; to be checked).

A unit of work is the persistence mechanism that writes changes in one transaction; it is not the same as an aggregate (Fowler, n.d.-a; ADR-0014).
A tool whose unit of work spans many aggregates only respects the rule if the use case does: one aggregate root per flush.

## Method

The same as ADR-0014: the [ICT Research Methods multi-criteria decision making method](https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/) with a weighted sum, a decision tree and a section on lack of prejudice (ICT Research Methods, n.d.).
The spike decides what documentation cannot: each requirement above becomes a test that runs against PostgreSQL in a container.

## Alternatives

| Option                             | What it is                                                                              | To check                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **MikroORM**                       | Data mapper with identity map and unit of work; version 7.2 at the time of writing      | Aggregate boundaries, version on the root, PostGIS custom types          |
| **Query builder and repositories** | A typed query builder (for example Kysely) with hand-written repositories per aggregate | More code, full control of aggregate loading and saving; not checked yet |
| **Drizzle, Prisma, TypeORM**       | Schema and query tools; the ADR-0014 research found they do not model aggregates        | Whether any of them can express a root-level version check               |
| **Plain driver**                   | The PostgreSQL client directly, with SQL in repositories                                | Lightest and most explicit; all mapping is ours                          |

## PostgreSQL drivers

The question is which driver talks to PostgreSQL, and whether the transaction guarantees are real for it.
MikroORM ships `@mikro-orm/postgresql`, which "works with cockroachdb too", and `@mikro-orm/pglite` for an embedded PostgreSQL in WASM, which could serve fast tests (MikroORM, n.d.-c).
The documentation states that "all changes computed during `em.flush()` are executed inside a database transaction by default" and names Cloudflare D1 as the one driver without explicit transactions (MikroORM, n.d.-c).
Which client library `@mikro-orm/postgresql` uses underneath, and which other PostgreSQL clients exist for the other options, is not in the pages read and is to be found out before the comparison (to check: the `pg` package and `postgres`).

## Sources on aggregates and the unit of work

The patterns, in the words of their sources, and what each ecosystem says about them:

- **Aggregate.** "A cluster of domain objects that can be treated as a single unit"; "transactions should not cross aggregate boundaries"; "aggregates are the basic element of transfer of data storage - you request to load or save whole aggregates" (Fowler, n.d.-b).
- **Repository.** "Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects" (Fowler, n.d.-c).
- **Unit of work.** "Maintains a list of objects affected by a business transaction and coordinates the writing out of changes and the resolution of concurrency problems" (Fowler, n.d.-a).
- **Spring Data JDBC** is built on these ideas: "each aggregate has exactly one aggregate root", everything reachable from the root belongs to the aggregate, references across aggregates are consistent eventually and not at all times, and there is no lazy loading, so an aggregate loads and saves as a whole; child entities are deleted and recreated when it is saved, so large aggregates are costly to write (Spring, n.d.).
- **Entity Framework Core.** Microsoft's guidance for DDD uses persistence-ignorant entities, private fields and read-only collections that the aggregate root controls, value objects as owned types, one repository per aggregate and the `DbContext` as unit of work (Microsoft, 2021).
- **SQLAlchemy.** The classical mapping makes the ORM depend on the domain model and not the other way round, so "our domain model classes stay blissfully unaware of the database" (Percival & Gregory, n.d.).
- **MikroORM.** "MikroORM uses the Identity Map pattern to track objects. Whenever you fetch an object from the database, MikroORM will keep a reference to this object inside its `UnitOfWork`", and "when you call `em.flush()`, all computed changes are queried inside a database transaction (if supported by given driver)" (MikroORM, n.d.-b). Its documentation does not present aggregates or DDD.

The patterns are also described in the Code chapter of the [software guidebook](../software-guidebook.md#76-back-end-aggregate-repository-and-unit-of-work-planned).

## Criteria (draft, weights to be set by the owner)

| #   | Criterion                          | What it asks                                                                                                    |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| D1  | Fit with the aggregate pattern     | One repository per root, explicit boundaries, references between aggregates by id, no hidden lazy loading       |
| D2  | Optimistic concurrency on the root | A version on the root, an error for the second committer, and a conflict also for changes to different children |
| D3  | Transactions and integrity         | One use case is one transaction, rollback on failure, isolation levels, pessimistic locking where needed        |
| D4  | Route to eventual consistency      | An outbox or domain events in the same transaction, without fighting the tool                                   |
| D5  | PostGIS and JSONB                  | Geometry and JSON columns round-trip, spatial queries stay possible                                             |
| D6  | Migrations                         | SQL migrations with Flyway stay the source of truth (ADR-0014); the tool does not need to generate them         |
| D7  | Driver and ecosystem health        | The driver options, their maintainers and licences, and how much code depends on them                           |
| D8  | Learnability and testing           | Close to what the owner knows (EF Core, Spring Data JDBC), and testable without heavy set-up                    |
| D9  | Footprint                          | Memory and start time next to the service (ADR-0014, C3), and the supply chain                                  |

## What MikroORM is documented to do so far

- A version property for optimistic locking, as a number or a timestamp; "version numbers (not timestamps) should however be preferred as they cannot potentially conflict in a highly concurrent environment".
  A mismatch at `em.flush()` throws an `OptimisticLockError` and rolls back the active transaction; `em.lock` and `findOne` with `LockMode.OPTIMISTIC` and an expected version check a version explicitly (MikroORM, n.d.-a).
- Transactions: all writes are queued until `em.flush()`, which wraps them in a single transaction; isolation levels up to `SERIALIZABLE`; pessimistic locking (MikroORM, n.d.-a).
- Not documented in the pages read: aggregates and DDD, domain events, an outbox, and whether a change to a child entity conflicts through the version of the root. These are the first spike tests.

## Spike tests (planned; none exist or have been run yet)

Each test runs against PostgreSQL in a container, for MikroORM and for the query-builder option.

1. Two sessions change different children of one aggregate; the second flush is rejected.
2. A use case writes two rows and fails on the second; neither row exists afterwards.
3. An aggregate save writes an outbox row in the same transaction; a failure removes both.
4. A PostGIS geometry and a JSONB column round-trip unchanged.
5. Partial load: an aggregate root saved without its children loaded leaves the children untouched (an unloaded collection is not an empty one).
6. Deletion is explicit: removing a child from its aggregate deletes that row, deleting the root deletes its composed children, and a reference to another aggregate (by id) deletes nothing.
7. Erasure of personal data: after the erasure use case for a swimrunner, no row with their personal data remains in any table, including outbox payloads, caches and stored files.

## Deletion and personal data

Deletion is a design decision for each relation and not an ORM default.
Inside an aggregate the children are composed, so they follow the root (and an orphan removed from the aggregate is deleted).
Between aggregates the reference is by id, and a database cascade across that line would cross the aggregate boundary.
Personal data is the case where that still has to happen: stored routes can reveal where someone lives (#63), so erasing a swimrunner must also erase their recordings, which are another aggregate.
The options are an explicit erasure use case that deletes across aggregates, an outbox event that triggers the deletion, or a deliberate foreign-key cascade on the tables that hold personal data; the owner decides, and test 7 holds whichever is chosen.
Backups and caches need their own retention rule, which belongs in the storage record (#63).
Which cascade and orphan-removal options MikroORM offers is to be checked in the spike.

## Next steps

1. The owner sets the weights and scores criteria D1 to D9; the evaluation and decision tree follow as in ADR-0014.
2. Write the seven spike tests for MikroORM and for the query-builder option and run them.
3. Decide, record the decision and the revisit triggers, and link it from ADR-0014 and ADR-0015.

## References

- Fowler, M. (n.d.-a). *Unit of work* [Patterns of enterprise application architecture]. Retrieved November 11, 2026, from https://martinfowler.com/eaaCatalog/unitOfWork.html
- Fowler, M. (n.d.-b). *DDD aggregate* [Bliki]. Retrieved November 11, 2026, from https://martinfowler.com/bliki/DDD_Aggregate.html
- Fowler, M. (n.d.-c). *Repository* [Patterns of enterprise application architecture]. Retrieved November 11, 2026, from https://martinfowler.com/eaaCatalog/repository.html
- ICT Research Methods. (n.d.). *Multi-criteria decision making*. Retrieved November 10, 2026, from https://ictresearchmethods.nl/workshop/multi-criteria-decision-making/
- Microsoft. (2021). *Implementing the infrastructure persistence layer with Entity Framework Core* [.NET microservices architecture]. Retrieved November 11, 2026, from https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-implementation-entity-framework-core
- MikroORM. (n.d.-a). *Transactions and concurrency* [Documentation]. Retrieved November 11, 2026, from https://mikro-orm.io/docs/transactions
- MikroORM. (n.d.-b). *Unit of work and identity map*. Retrieved November 11, 2026, from https://mikro-orm.io/docs/unit-of-work
- MikroORM. (n.d.-c). *Usage with SQL drivers* [Documentation]. Retrieved November 11, 2026, from https://mikro-orm.io/docs/usage-with-sql
- Percival, H., & Gregory, B. (n.d.). *Repository pattern* [Chapter 2]. In *Architecture patterns with Python*. Retrieved November 11, 2026, from https://www.cosmicpython.com/book/chapter_02_repository.html
- Spring. (n.d.). *Domain-driven design and relational databases* [Spring Data JDBC reference]. Retrieved November 11, 2026, from https://docs.spring.io/spring-data/relational/reference/jdbc/domain-driven-design.html
