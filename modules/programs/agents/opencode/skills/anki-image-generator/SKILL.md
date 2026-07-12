---
name: anki-image-generator
description: >
  Generate images for vocabulary cards using their image prompts from a JSON file.
  Triggers when the user asks to generate images for words, vocab lists, or JSON files
  to be used for Anki, or wants to populate a media folder with images corresponding
  to a list of vocabulary entries. Vietnamese triggers: "tạo ảnh từ vựng", "tạo ảnh
  Anki", "tạo hình ảnh cho từ mới", "tải ảnh từ prompt", "generate images for json".
---

# Anki Image Generator Skill

This skill guides the agent in reading a vocabulary JSON file, extracting the `image_prompt` for each word, generating the corresponding image, converting/saving it as a JPEG file, and storing it inside the `media/` directory of the workspace.

---

## Workflow

### Step 1: Read the Input JSON File

- Locate the vocabulary JSON file (typically `data.json` or another JSON path specified by the user).
- Parse the JSON content which should be an array of vocabulary objects.

### Step 2: Iterate and Filter Items

- For each vocabulary item in the array:
  - Check if the `image_prompt` exists and is NOT `"N/A"`, empty, or missing.
  - Format the target filename (convert `image_prompt` to `snake_case` with `.jpg` extension).
  - Check if the file `media/<prompt_image_snake_case>.jpg` already exists in the workspace.
  - If the target image file already exists, **SKIP** this item to avoid duplicate generation and conserve resources.
  - If the image does not exist yet, proceed to Step 3.

### Step 3: Format the Output Filename

- Convert the `image_prompt` string to a clean `snake_case` filename:
  - Remove special characters, punctuation (like commas, periods, quotes).
  - Convert all letters to lowercase.
  - Replace spaces and consecutive spaces/hyphens with a single underscore `_`.
  - Append the `.jpg` extension.
  - Format the final path: `media/<prompt_image_snake_case>.jpg`.

### Step 4: Generate the Image

- Prior to calling the `generate_image` tool, enrich the raw `image_prompt` to make it optimal for a vocabulary learning flashcard:
  - Add descriptive details to ensure the subject is clear, centered, and easily recognizable.
  - Specify the style if needed (e.g., "clean, modern vector illustration", "vibrant 3D render", or "high-quality photo on a clean, simple background").
  - Explicitly include instructions to avoid any text or labels inside the image (e.g., "no text, no words, clean composition").
- Call the `generate_image` tool with the enriched prompt.
- Set `ImageName` to a short version of the prompt or word (maximum 3 words, lowercase, using underscores).

### Step 5: Save/Move to the Media Directory

- The `generate_image` tool saves the image in the artifact directory.
- Copy or move this image file to `media/<prompt_image_snake_case>.jpg` in the workspace directory.
- Create the `media/` directory if it does not exist.
- Ensure the image is saved or converted as a valid JPEG (`.jpg`).

---

## Filename Formatting Examples

| Original `image_prompt`                                                         | Output Filename                                                                        |
| :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------- |
| `"A runner pushing hard to cross the finish line with determination"`           | `media/a_runner_pushing_hard_to_cross_the_finish_line_with_determination.jpg`          |
| `"A hand reaching out to grab a golden star hanging from the sky"`              | `media/a_hand_reaching_out_to_grab_a_golden_star_hanging_from_the_sky.jpg`             |
| `"A bar of soap next to a green leaf and a clinical bottle, clean studio shot"` | `media/a_bar_of_soap_next_to_a_green_leaf_and_a_clinical_bottle_clean_studio_shot.jpg` |
