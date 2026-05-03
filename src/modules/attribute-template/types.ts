/**
 * Attribute Template Module Types
 * Defines user attributes and template structures
 */

// Question type for rendering attribute options
export type QuestionType = 'dropdown' | 'radio' | 'buttonRadio';

// Question type options for the selector
export const QUESTION_TYPE_OPTIONS: { id: QuestionType; label: string; description: string }[] = [
  { id: 'dropdown', label: 'Dropdown', description: 'Single select from a dropdown menu' },
  { id: 'radio', label: 'Radio Buttons', description: 'Single select from radio buttons' },
  { id: 'buttonRadio', label: 'Button Radio', description: 'Single select from styled button options' },
];

// Fixed options for Gender (not editable)
export const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', questionType: 'buttonRadio' as QuestionType },
  { id: 'female', label: 'Female', questionType: 'buttonRadio' as QuestionType },
  { id: 'other', label: 'Other', questionType: 'buttonRadio' as QuestionType },
  { id: 'prefer-not-to-say', label: 'Prefer not to say', questionType: 'buttonRadio' as QuestionType },
] as const;

// Fixed options for Age (not editable)
export const AGE_RANGES = [
  { id: '18-24', label: '18-24', questionType: 'buttonRadio' as QuestionType },
  { id: '25-34', label: '25-34', questionType: 'buttonRadio' as QuestionType },
  { id: '35-44', label: '35-44', questionType: 'buttonRadio' as QuestionType },
  { id: '45-54', label: '45-54', questionType: 'buttonRadio' as QuestionType },
  { id: '55-64', label: '55-64', questionType: 'buttonRadio' as QuestionType },
  { id: '65+', label: '65+', questionType: 'buttonRadio' as QuestionType },
] as const;

// Field types
export type FieldType = 
  | 'stream' 
  | 'location' 
  | 'function' 
  | 'department' 
  | 'seniority' 
  | 'gender' 
  | 'age';

// Simple option for fields
export interface FieldOption {
  id: string;
  label: string;
  questionType?: QuestionType; // How this attribute should be rendered
}

// Default question types for common attribute patterns
export const DEFAULT_QUESTION_TYPES: Record<FieldType, QuestionType> = {
  stream: 'dropdown',
  department: 'dropdown',
  function: 'dropdown',
  location: 'dropdown',
  seniority: 'radio',
  gender: 'buttonRadio',
  age: 'buttonRadio',
};

// Location option linked to a Stream
export interface LocationOption extends FieldOption {
  streamId: string; // Required: each location must be linked to a stream
}

// Function option linked to a Location
export interface FunctionOption extends FieldOption {
  locationId: string; // Required: each function must be linked to a location
}

// Department option linked to a Function
export interface DepartmentOption extends FieldOption {
  functionId: string; // Required: each department must be linked to a function
}

// Complete template field definition
export interface TemplateField {
  type: FieldType;
  label: string;
  options: FieldOption[];
  isFixed?: boolean; // true for gender and age
  questionType?: QuestionType;
}

// Attribute Template
export interface AttributeTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  
  // Field configurations
  stream: FieldOption[];
  location: LocationOption[]; // Locations linked to streams
  function: FunctionOption[]; // Functions linked to locations
  department: DepartmentOption[]; // Departments linked to functions
  seniority: FieldOption[];
  
  // Fixed fields (not editable)
  gender: typeof GENDER_OPTIONS;
  age: typeof AGE_RANGES;
}

// Create/Update DTO
export interface CreateAttributeTemplateDto {
  name: string;
  description?: string;
  stream: FieldOption[];
  location: LocationOption[];
  function: FunctionOption[];
  department: DepartmentOption[];
  seniority: FieldOption[];
}

export interface UpdateAttributeTemplateDto extends Partial<CreateAttributeTemplateDto> {
  id: string;
}

// Prompt for super admin to choose design/layout
export interface AttributePrompt {
  fieldType: FieldType;
  question: string;
  options: string[];
  currentType?: QuestionType;
}
