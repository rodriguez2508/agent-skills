# Rule: TypeScript Strict Mode
**Category:** typescript  
**Impact:** HIGH  
**Tags:** typescript, strict, types, safety

## Description
TypeScript MUST be configured in strict mode to catch errors at compile time and improve code quality.

## Rules

### tsconfig.json Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### No Implicit Any
```typescript
// ❌ WRONG - Implicit any
function logValue(value) {
  console.log(value);
}

// ✅ CORRECT - Explicit type
function logValue(value: string): void {
  console.log(value);
}

// ✅ CORRECT - Generic when appropriate
function logValue<T>(value: T): T {
  console.log(value);
  return value;
}
```

### Strict Null Checks
```typescript
// ❌ WRONG - May be undefined
function getLength(str: string): number {
  return str.length; // Error if str could be null
}

// ✅ CORRECT - Handle null explicitly
function getLength(str: string | null): number {
  return str?.length ?? 0;
}

// ✅ CORRECT - Non-null assertion when certain
function getLength(str: string | null): number {
  return str!.length; // Only if you're 100% sure
}
```

### Type Guards
```typescript
// ❌ WRONG - Type assertion without check
const length = (element as HTMLElement).offsetHeight;

// ✅ CORRECT - Type guard
function isHTMLElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement;
}

if (isHTMLElement(element)) {
  const length = element.offsetHeight;
}
```

### Interface vs Type Alias
```typescript
// Use interface for object shapes (extends, implements)
interface Rule {
  id: string;
  name: string;
}

interface SearchableRule extends Rule {
  score: number;
}

// Use type for unions, primitives, tuples
type RuleStatus = 'active' | 'inactive' | 'draft';
type RuleId = string;
type RuleTuple = [RuleId, string];
```

### Avoid Type Assertions
```typescript
// ❌ WRONG - Blind assertion
const rule = someValue as Rule;

// ✅ CORRECT - Type guard or validation
function isRule(value: unknown): value is Rule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

if (isRule(someValue)) {
  // Type is narrowed to Rule
}
```

## Related Rules
- `NO_EXPLICIT_ANY` - Avoid any type
- `TYPE_SAFETY_FIRST` - Prefer types over assertions
- `GENERIC_CONSTRAINTS` - Constrained generics
