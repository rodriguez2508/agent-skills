# Rule: Input Validation Pattern
**Category:** nestjs  
**Impact:** HIGH  
**Tags:** validation, dto, class-validator, input-sanitization

## Description
All user input MUST be validated using class-validator decorators and DTOs before processing.

## Rules

### DTO Definition with Validation
```typescript
// src/modules/rules/presentation/dto/create-rule.dto.ts
import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({
    description: 'Rule name',
    example: 'Clean Architecture Layers',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Rule content in markdown',
    example: '# Rule: Description...',
    minLength: 10,
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiProperty({
    description: 'Rule category',
    example: 'architecture',
    pattern: '^[a-z]+(-[a-z]+)*$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]+(-[a-z]+)*$/, {
    message: 'Category must be lowercase kebab-case',
  })
  category: string;

  @ApiPropertyOptional({
    description: 'Rule tags',
    example: ['clean-architecture', 'layers'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Rule impact level',
    enum: RuleImpact,
    default: RuleImpact.MEDIUM,
  })
  @IsOptional()
  @IsEnum(RuleImpact)
  impact?: RuleImpact;
}
```

### Global Validation Pipe
```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for extra properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,
      disableErrorMessages: false,
      exceptionFactory: (errors) => {
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: errors.map((error) => ({
            property: error.property,
            constraints: error.constraints,
            value: error.value,
          })),
        });
      },
    }),
  );
  
  await app.listen(3000);
}
```

### Custom Validation Constraints
```typescript
// src/shared/validators/is-valid-category.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsValidCategoryConstraint implements ValidatorConstraintInterface {
  private readonly validCategories = [
    'architecture',
    'typescript',
    'nestjs',
    'testing',
    'code-style',
  ];

  validate(category: string): boolean {
    if (!category || typeof category !== 'string') {
      return false;
    }
    return this.validCategories.includes(category.toLowerCase());
  }

  defaultMessage(): string {
    return 'Category must be one of: $constraint';
  }
}

export function IsValidCategory(validationOptions?: ValidationOptions) {
  return function (object: NonNullable<unknown>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCategoryConstraint,
    });
  };
}
```

### Query Parameter Validation
```typescript
// src/modules/rules/presentation/dto/search-rules-query.dto.ts
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchRulesQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: 'relevance' | 'date' | 'name';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

### Validation Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "property": "name",
      "constraints": {
        "isNotEmpty": "name should not be empty",
        "maxLength": "name must be shorter than or equal to 200 characters"
      }
    },
    {
      "property": "category",
      "constraints": {
        "matches": "Category must be lowercase kebab-case"
      }
    }
  ]
}
```

### Request Body Transformation
```typescript
// Command mapping in controller
@Post()
async createRule(@Body() dto: CreateRuleDto): Promise<RuleResponseDto> {
  // DTO is already validated and transformed by ValidationPipe
  const command = new CreateRuleCommand(
    dto.name,
    dto.content,
    dto.category,
    dto.tags,
    dto.impact,
  );
  
  const rule = await this.commandBus.execute(command);
  return plainToClass(RuleResponseDto, rule);
}
```

## Related Rules
- `DTO_PATTERN` - Data Transfer Objects
- `ERROR_HANDLING` - Error responses
- `INPUT_SANITIZATION` - XSS prevention
