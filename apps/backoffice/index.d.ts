/// <reference types="@nx/next/typings/style.d.ts" />
// biome-ignore-all lint/suspicious/noExplicitAny: módulos .svg não têm tipo estático
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}
