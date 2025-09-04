import { z } from 'zod';

// Poll creation validation schema
export const createPollSchema = z.object({
  question: z
    .string()
    .min(3, 'Question must be at least 3 characters long')
    .max(500, 'Question must be less than 500 characters')
    .trim(),
  options: z
    .array(
      z
        .string()
        .min(1, 'Option cannot be empty')
        .max(200, 'Option must be less than 200 characters')
        .trim()
    )
    .min(2, 'Poll must have at least 2 options')
    .max(10, 'Poll cannot have more than 10 options')
    .refine((options) => {
      const uniqueOptions = new Set(options.map(opt => opt.toLowerCase()));
      return uniqueOptions.size === options.length;
    }, 'All options must be unique'),
});

// Poll update validation schema
export const updatePollSchema = createPollSchema;

// Sanitize HTML content to prevent XSS
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Validate and sanitize poll data
export function validateAndSanitizePollData(data: {
  question: string;
  options: string[];
}) {
  try {
    // Validate structure
    const validated = createPollSchema.parse(data);
    
    // Sanitize content
    return {
      question: sanitizeText(validated.question),
      options: validated.options.map(opt => sanitizeText(opt)),
      error: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        question: '',
        options: [],
        error: error.errors.map(e => e.message).join(', ')
      };
    }
    return {
      question: '',
      options: [],
      error: 'Invalid poll data'
    };
  }
}
