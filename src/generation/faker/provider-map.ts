import type { Faker } from '@faker-js/faker';

export interface NamePattern {
  pattern: RegExp;
  call: (f: Faker) => unknown;
}

// Ordered from most-specific to least-specific; first match wins
export const NAME_PATTERNS: NamePattern[] = [
  { pattern: /email/i, call: (f) => f.internet.email() },
  { pattern: /first.?name|firstname/i, call: (f) => f.person.firstName() },
  { pattern: /last.?name|lastname|surname/i, call: (f) => f.person.lastName() },
  { pattern: /^(full.?name|display.?name)$/i, call: (f) => f.person.fullName() },
  { pattern: /phone|mobile|tel(?!escope)/i, call: (f) => f.phone.number() },
  { pattern: /street|address/i, call: (f) => f.location.streetAddress() },
  { pattern: /city/i, call: (f) => f.location.city() },
  { pattern: /state|province/i, call: (f) => f.location.state() },
  { pattern: /country/i, call: (f) => f.location.country() },
  { pattern: /zip|postal/i, call: (f) => f.location.zipCode() },
  { pattern: /latitude|lat(?!_id)/i, call: (f) => f.location.latitude() },
  { pattern: /longitude|lng|lon(?!g_id)/i, call: (f) => f.location.longitude() },
  { pattern: /avatar|photo|image/i, call: (f) => f.image.avatar() },
  { pattern: /url|website|site(?!_id)/i, call: (f) => f.internet.url() },
  { pattern: /username|user.?name/i, call: (f) => f.internet.username() },
  { pattern: /password|passwd/i, call: (f) => f.internet.password() },
  { pattern: /ip.?address|ip(?!_id)/i, call: (f) => f.internet.ip() },
  { pattern: /token|api.?key/i, call: (f) => f.string.alphanumeric(32) },
  { pattern: /slug/i, call: (f) => f.helpers.slugify(f.lorem.words(3)) },
  { pattern: /title(?!_id)/i, call: (f) => f.lorem.sentence(4) },
  { pattern: /description|bio|about|summary|notes?/i, call: (f) => f.lorem.paragraph() },
  { pattern: /content|body|message|text/i, call: (f) => f.lorem.paragraphs(2) },
  { pattern: /price|amount|cost|salary|wage|fee/i, call: (f) => parseFloat(f.commerce.price()) },
  { pattern: /quantity|qty|count|stock/i, call: (f) => f.number.int({ min: 1, max: 100 }) },
  { pattern: /age/i, call: (f) => f.number.int({ min: 18, max: 90 }) },
  { pattern: /rating|score|rank/i, call: (f) => f.number.int({ min: 1, max: 5 }) },
  { pattern: /year/i, call: (f) => f.number.int({ min: 1990, max: 2025 }) },
  { pattern: /created.?at|updated.?at|deleted.?at|timestamp/i, call: (f) => f.date.past().toISOString() },
  { pattern: /date(?!_id)/i, call: (f) => f.date.past().toISOString().split('T')[0] },
  { pattern: /color|colour/i, call: (f) => f.color.human() },
  { pattern: /company|employer|org(?!anization)/i, call: (f) => f.company.name() },
  { pattern: /job.?title|position|occupation/i, call: (f) => f.person.jobTitle() },
  { pattern: /department/i, call: (f) => f.commerce.department() },
  { pattern: /product|item(?!_id)/i, call: (f) => f.commerce.productName() },
  { pattern: /category|type(?!_id)/i, call: (f) => f.commerce.department() },
  { pattern: /sku|barcode/i, call: (f) => f.string.alphanumeric(8).toUpperCase() },
  { pattern: /status(?!_id)/i, call: (f) => f.helpers.arrayElement(['active', 'inactive', 'pending']) },
  { pattern: /gender|sex/i, call: (f) => f.helpers.arrayElement(['male', 'female', 'other']) },
  { pattern: /currency(?!_id)/i, call: (f) => f.finance.currencyCode() },
  { pattern: /tag(?!_id)/i, call: (f) => f.lorem.word() },
  // Fallback: name alone → full name
  { pattern: /^name$/i, call: (f) => f.person.fullName() },
];

export function valueFromNamePattern(faker: Faker, columnName: string): unknown | null {
  for (const { pattern, call } of NAME_PATTERNS) {
    if (pattern.test(columnName)) return call(faker);
  }
  return null; // no pattern matched → caller falls back to data-type generator
}

export function callFakerProvider(faker: Faker, provider: string): unknown {
  const dotIdx = provider.indexOf('.');
  if (dotIdx === -1) return faker.lorem.word();
  const module = provider.slice(0, dotIdx);
  const method = provider.slice(dotIdx + 1);
  const mod = (faker as unknown as Record<string, Record<string, () => unknown>>)[module];
  if (!mod || typeof mod[method] !== 'function') return faker.lorem.word();
  return mod[method]();
}
