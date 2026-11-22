# Modules

Each folder in `app/modules/` is a **deep module**: a lot of behaviour behind a small interface.

```
app/modules/
  <name>/
    index.ts          ← an entry point (public). Import this from outside.
    index.server.ts   ← another entry point. A module may expose several.
    lib/              ← implementation: private, free to import each other.
    tests/            ← tests + fixtures: private, test through the entry points.
```

Copy `example/` to start a new module.

**Import only through a module's entry points (its root files).** Anything in a subfolder is private, whatever the folder is called.

**Don't write barrel files.** Expose several small entry points instead of re-exporting a whole subtree through one `index.ts`.

**An entry point that forwards to `lib/` is the convention, not a Middle Man.** It is the module's public surface, as in `example/index.ts`; the behaviour lives in `lib/`.

## The rules

Enforced by dependency-cruiser (`.dependency-cruiser.cjs`). Run `npm run lint:boundaries`, or `npm run check` for typecheck + boundaries + tests.

1. **Entry-point boundary.** Code outside a module (routes, `app/lib`, other modules) imports only that module's root files, never anything in its subfolders.
2. **Intra-module freedom.** A module's own files import each other freely.
3. **Tests through the entry points.** Files in `<module>/tests/` import any module's entry points and their own `tests/` fixtures, never any module's subfolder internals, not even their own. Nothing outside `tests/` may import from it.
4. **No cycles.** No dependency cycles anywhere in `app/`.
5. **The database comes in through the entry points.** Only a module's root files import the `db` connection from `~/db`; `lib/` takes it as an argument, so tests can pass `createTestDb()` instead.
6. **Modules sit below the UI.** A module never imports from `app/components/`.

`npm run lint:modules` checks that every module has a `tests/` folder.

Modules are flat: one level of folders under `app/modules/`. A module may not contain another module.
