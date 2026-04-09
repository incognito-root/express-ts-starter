import fs from "fs";
import path from "path";

import Handlebars from "handlebars";

// Go up from utils/emails to src, then into templates
const templatesDir = path.join(__dirname, "../../templates");

export const getEmailTemplate = (
  templateName: string,
  data: Record<string, unknown>
): string => {
  const templatePath = path.join(templatesDir, `${templateName}.hbs`);
  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const template = Handlebars.compile(templateContent);
  return template(data);
};
