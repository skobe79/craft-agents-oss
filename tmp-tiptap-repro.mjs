import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown as OfficialMarkdown } from '@tiptap/markdown'
import { Mathematics } from '@tiptap/extension-mathematics'
import Image from '@tiptap/extension-image'
import FileHandler from '@tiptap/extension-file-handler'
import { tiptapCodeBlock } from './packages/ui/src/components/markdown/TiptapCodeBlockView.tsx'
import { MermaidBlock } from './packages/ui/src/components/markdown/extensions/MermaidBlock.tsx'
import { LatexBlock } from './packages/ui/src/components/markdown/extensions/LatexBlock.tsx'

const content = `Three-pane layout with **projects**, **headings**, **tasks**, and detail view.

## Requirements
- Keep rhythm calm and lightweight
- Panels should match the main app chrome
- Resize handles with gradient feedback

> The detail pane should feel like Linear's issue view.
`

const editor = new Editor({
  extensions: [
    StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] } }),
    tiptapCodeBlock,
    MermaidBlock,
    LatexBlock,
    Image.configure({ inline: false, allowBase64: true }),
    FileHandler.configure({}),
    Mathematics.configure({ katexOptions: { throwOnError: false, strict: false } }),
    OfficialMarkdown.configure({ markedOptions: { gfm: true } }),
  ],
  content,
  contentType: 'markdown',
})

editor.chain().focus('end').setCodeBlock({ language: 'text' }).insertContent(' ').run()
const cursor = editor.state.selection.from
editor.chain().focus().setTextSelection({ from: Math.max(1, cursor - 1), to: cursor }).run()
editor.chain().focus().insertContent('hello').run()

console.log('json has codeBlock', JSON.stringify(editor.getJSON()).includes('codeBlock'))
console.log('markdown:\n' + editor.getMarkdown())
