import '@testing-library/jest-dom';

// Mock window.URL.createObjectURL and revokeObjectURL for tests
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = (blob: any) => `blob:mock-url-${blob?.size || 0}`;
  window.URL.revokeObjectURL = () => {};
}
