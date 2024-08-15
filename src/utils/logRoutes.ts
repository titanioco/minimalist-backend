import { Application } from "express-serve-static-core";

const logRoutes = (app: Application) => {
    console.log('Registered routes:');
    const printRoutes = (stack: any[], basePath: string = '') => {
        stack.forEach((layer) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
                console.log(`${methods} ${basePath}${layer.route.path}`);
            } else if (layer.name === 'router') {
                // Extract the path from the regexp
                let path = layer.regexp.toString()
                    .replace('/^', '')
                    .replace('\\/?(?=\\/|$)/i', '')
                    .replace(/\\/g, '');
                
                // Remove any remaining regex characters except for forward slashes
                path = path.replace(/\^|\$|\(|\)|\?|=|\|/g, '');

                // Ensure there's only one forward slash between path segments
                path = ('/' + path).replace(/\/+/g, '/');

                printRoutes(layer.handle.stack, basePath + path);
            }
        });
    };
    printRoutes(app._router.stack);
};

export default logRoutes;