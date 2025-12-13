declare module '*/image-mapping.json' {
  interface RVImageData {
    description: string;
    year: number | null;
    manufacturer: string;
    make: string;
    model: string;
    isNew: boolean;
    price: number;
    images: string[];
    primaryImage: string;
    itemDetailUrl: string;
  }

  const value: Record<string, RVImageData>;
  export default value;
}
