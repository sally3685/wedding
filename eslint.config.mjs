import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    plugins: {
      boundaries,
    },

    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },

      "boundaries/root-path": process.cwd(),

      "boundaries/elements": [
        {
          type: "feature",
          pattern: "features/*",
        },
        {
          type: "strapi",
          pattern: "lib/strapi",
        },
        {
          type: "strapi-custom",
          pattern: "lib/strapi-custom",
        },
      ],
    },

    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",

          policies: [
            {
              to: {
                element: {
                  type: ["feature", "strapi", "strapi-custom"],
                },
              },

              disallow: {
                to: {
                  element: {
                    fileInternalPath: "**/*",
                  },
                },
              },
            },
            {
              to: {
                element: {
                  type: ["feature", "strapi", "strapi-custom"],
                  fileInternalPath: "index.ts",
                },
              },

              allow: {
                to: {
                  element: {
                    fileInternalPath: "index.ts",
                  },
                },
              },
            },
            {
              to: {
                element: {
                  type: ["feature", "strapi", "strapi-custom"],
                  fileInternalPath: "server/index.ts",
                },
              },

              allow: {
                to: {
                  element: {
                    fileInternalPath: "server/index.ts",
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
