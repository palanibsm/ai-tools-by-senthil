declare module "translate-google" {
  type TranslateOptions = {
    from?: string;
    to?: string;
  };

  export default function translate(text: string, options?: TranslateOptions): Promise<string>;
}
