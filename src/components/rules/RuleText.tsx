"use client";
import { Fragment } from "react";

export default function RuleText({ text }: { text: string }) {
  return (
    <div>
      {text.split(/\n\s*\n/).map((block, i) => (
        <p key={i}>
          {block.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
