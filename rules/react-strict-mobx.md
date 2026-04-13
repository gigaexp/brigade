# React strict rules — MobX + Presenter/Container

Opinionated rules for React projects that use MobX for state management and enforce a
presenter/container split. Import this file from your project's `CLAUDE.md` when you want
these rules active:

```markdown
@~/.claude/plugins/brigade/rules/react-strict-mobx.md
```

## useEffect — restricted usage

- `useEffect` is ONLY allowed with an empty dependency array `[]` (mount/unmount lifecycle).
- Do NOT use `useEffect` for derived state, data fetching, or reacting to prop/state changes.
- Instead: MobX `reaction` / `autorun`, `computed`, or store methods called from event handlers.

## State & business logic — stores only

- ALL business logic MUST live in MobX stores — global or local. Never in components.
- UI components must be pure: render store state, call store actions. Nothing else.
- **No React hooks for reactivity or derived state.** Forbidden for business logic:
  - `useState` for anything beyond trivial UI-only state (e.g. "is dropdown open"). Domain state → store.
  - `useMemo` / `useCallback` for derived values → use MobX `computed`.
  - `useEffect` to sync state, fetch data, or react to changes → use store methods or MobX reactions.
  - `useRef` to hold mutable business state → store field.
- **Local component state → local MobX store** via `useLocalObservable(() => new SomeStore(deps))` (`mobx-react-lite`). Wrap the component in `observer()`. Never reach for `useState` + `useEffect` to emulate a store.
- No business logic in event handlers — call a store action. Handler body should be a single `store.doThing()` call.
- If a component has more than ~10 lines of non-JSX logic, extract it to a store.

## Presenter / Container split

- Container reads store, passes plain props to a pure presenter component.
- Presenter has **zero** store imports and zero side effects.
- Presenter is testable in isolation without mocking the store.
