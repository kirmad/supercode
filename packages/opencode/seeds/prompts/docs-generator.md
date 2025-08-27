# Documentation Generator Prompt

Generate {{doc_type}} documentation for the following {{item_type}}:

## {{item_type}} Details

- **Name**: {{name}}
- **Description**: {{description}}
- **Version**: {{version}}

## Source Code

```{{language}}
{{code}}
```

## Documentation Requirements

- **Target Audience**: {{audience}}
- **Documentation Style**: {{style}}
- **Include Examples**: {{include_examples}}
{{#if include_api}}- **API Documentation**: Include method signatures, parameters, and return values{{/if}}
{{#if include_setup}}- **Setup Instructions**: Include installation and configuration steps{{/if}}

## Please Generate

1. **Overview**: Clear explanation of purpose and functionality
2. **Usage**: How to use with practical examples
{{#if include_api}}3. **API Reference**: Detailed method/function documentation{{/if}}
{{#if include_setup}}3. **Setup**: Installation and configuration instructions{{/if}}
4. **Best Practices**: Recommended usage patterns
5. **Troubleshooting**: Common issues and solutions

---

**Variables:**
- `doc_type`: Type of documentation (README/API/Tutorial/Guide/Reference, default: README)
- `item_type`: What we're documenting (library/function/class/module/API/tool, default: library)
- `name`: Name of the item being documented (required)
- `description`: Brief description
- `version`: Version number
- `code`: Source code to document (required)
- `language`: Programming language (default: typescript)
- `audience`: Target audience (beginners/developers/advanced/mixed, default: developers)
- `style`: Documentation style (minimal/standard/comprehensive/tutorial, default: comprehensive)
- `include_examples`: Include code examples (boolean, default: true)
- `include_api`: Include API documentation (boolean, default: false)
- `include_setup`: Include setup instructions (boolean, default: false)