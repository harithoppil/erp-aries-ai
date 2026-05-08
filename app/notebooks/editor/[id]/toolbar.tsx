"use client";

import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon, Undo, Redo,
  Highlighter, Palette,
} from "lucide-react";

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const toggleColor = () => {
    const color = window.prompt("Color (hex)", "#0ea5e9");
    if (color) editor.chain().focus().setColor(color).run();
  };

  const toggleHighlight = () => {
    const color = window.prompt("Highlight color (hex)", "#fef08a");
    if (color) editor.chain().focus().toggleHighlight({ color }).run();
  };

  const btn = (onClick: () => void, icon: React.ReactNode, active = false, title: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className={`h-8 w-8 ${active ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
    >
      {icon}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-white px-2 py-1.5">
      {/* History */}
      {btn(() => editor.chain().focus().undo().run(), <Undo size={16} />, false, "Undo")}
      {btn(() => editor.chain().focus().redo().run(), <Redo size={16} />, false, "Redo")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Headings */}
      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={16} />, editor.isActive("heading", { level: 1 }), "Heading 1")}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={16} />, editor.isActive("heading", { level: 2 }), "Heading 2")}
      {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={16} />, editor.isActive("heading", { level: 3 }), "Heading 3")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Text style */}
      {btn(() => editor.chain().focus().toggleBold().run(), <Bold size={16} />, editor.isActive("bold"), "Bold")}
      {btn(() => editor.chain().focus().toggleItalic().run(), <Italic size={16} />, editor.isActive("italic"), "Italic")}
      {btn(() => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />, editor.isActive("underline"), "Underline")}
      {btn(() => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />, editor.isActive("strike"), "Strike")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Lists */}
      {btn(() => editor.chain().focus().toggleBulletList().run(), <List size={16} />, editor.isActive("bulletList"), "Bullet List")}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />, editor.isActive("orderedList"), "Ordered List")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Alignment */}
      {btn(() => editor.chain().focus().setTextAlign("left").run(), <AlignLeft size={16} />, editor.isActive({ textAlign: "left" }), "Align Left")}
      {btn(() => editor.chain().focus().setTextAlign("center").run(), <AlignCenter size={16} />, editor.isActive({ textAlign: "center" }), "Align Center")}
      {btn(() => editor.chain().focus().setTextAlign("right").run(), <AlignRight size={16} />, editor.isActive({ textAlign: "right" }), "Align Right")}
      {btn(() => editor.chain().focus().setTextAlign("justify").run(), <AlignJustify size={16} />, editor.isActive({ textAlign: "justify" }), "Justify")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Color & Highlight */}
      {btn(toggleColor, <Palette size={16} />, editor.isActive("textStyle"), "Text Color")}
      {btn(toggleHighlight, <Highlighter size={16} />, editor.isActive("highlight"), "Highlight")}
      <div className="mx-1 h-5 w-px bg-slate-200" />

      {/* Insert */}
      {btn(setLink, <LinkIcon size={16} />, editor.isActive("link"), "Link")}
      {btn(addImage, <ImageIcon size={16} />, false, "Image")}
      {btn(addTable, <TableIcon size={16} />, false, "Table")}
    </div>
  );
}
