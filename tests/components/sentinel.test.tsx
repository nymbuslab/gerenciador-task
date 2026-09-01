import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("harness de componentes", () => {
  it("renderiza o shell inicial com um título acessível", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "A operação do dia, em um só lugar.",
      }),
    ).toBeVisible();
  });
});
