import 'server-only';

import type { AttributeTemplate } from '@/modules/attribute-template/types';
import { runMongoScript } from '../mongo-shell';

export type AttributeTemplateDocument = AttributeTemplate;

let indexPromise: Promise<void> | null = null;

export async function ensureAttributeTemplateIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(`
const __ensureIndex = (collectionName, key, options = {}) => {
  const collection = db.getCollection(collectionName);
  let existing;
  try {
    existing = collection
      .getIndexes()
      .find((index) => {
        return JSON.stringify(index.key) === JSON.stringify(key);
      });
  } catch (e) {
    existing = null;
  }

  if (existing) {
    return existing.name;
  }

  return collection.createIndex(key, options);
};

__ensureIndex('attributeTemplates', { id: 1 }, { unique: true, name: 'admin_attr_template_id_unique' });

__emit(null);
`).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

export async function getAllAttributeTemplatesData(): Promise<AttributeTemplateDocument[]> {
  await ensureAttributeTemplateIndexes();
  return runMongoScript<AttributeTemplateDocument[]>(`
const templates = db.attributeTemplates.find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
__emit(__strip(templates));
`);
}

export async function getAttributeTemplateByIdData(id: string): Promise<AttributeTemplateDocument | null> {
  await ensureAttributeTemplateIndexes();
  return runMongoScript<AttributeTemplateDocument | null>(`
const template = db.attributeTemplates.findOne({ id: __payload.id }, { projection: { _id: 0 } });
__emit(__strip(template));
`, { id });
}

export async function insertAttributeTemplateDocument(
  template: AttributeTemplateDocument
): Promise<AttributeTemplateDocument> {
  await ensureAttributeTemplateIndexes();
  return runMongoScript<AttributeTemplateDocument>(`
db.attributeTemplates.insertOne(__payload.template);
__emit(__strip(__payload.template));
`, { template });
}

export async function updateAttributeTemplateDocument(
  id: string,
  updates: Partial<AttributeTemplateDocument>
): Promise<AttributeTemplateDocument | null> {
  await ensureAttributeTemplateIndexes();
  return runMongoScript<AttributeTemplateDocument | null>(`
const updated = db.attributeTemplates.findOneAndUpdate(
  { id: __payload.id },
  { $set: __payload.updates },
  { returnDocument: 'after', projection: { _id: 0 } }
);
__emit(__strip(updated));
`, { id, updates });
}

export async function deleteAttributeTemplateDocument(id: string): Promise<boolean> {
  await ensureAttributeTemplateIndexes();
  return runMongoScript<boolean>(`
const result = db.attributeTemplates.deleteOne({ id: __payload.id });
__emit(result.deletedCount > 0);
`, { id });
}