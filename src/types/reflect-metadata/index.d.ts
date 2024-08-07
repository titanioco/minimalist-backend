declare module "reflect-metadata" {
    global {
      namespace Reflect {
        function decorate(decorators: ClassDecorator[], target: Object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void;
        function metadata(metadataKey: any, metadataValue: any): {
          (target: Function): void;
          (target: Object, propertyKey: string | symbol): void;
        };
        function defineMetadata(metadataKey: any, metadataValue: any, target: Object, propertyKey?: string | symbol): void;
        function hasMetadata(metadataKey: any, target: Object, propertyKey?: string | symbol): boolean;
        function hasOwnMetadata(metadataKey: any, target: Object, propertyKey?: string | symbol): boolean;
        function getMetadata(metadataKey: any, target: Object, propertyKey?: string | symbol): any;
        function getOwnMetadata(metadataKey: any, target: Object, propertyKey?: string | symbol): any;
        function deleteMetadata(metadataKey: any, target: Object, propertyKey?: string | symbol): boolean;
      }
    }
  }