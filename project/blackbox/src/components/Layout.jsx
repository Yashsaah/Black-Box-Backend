import { useEffect } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import useInView from "../lib/useInView";

// [path, label, isCta] — the CTA sits last and gets the outlined treatment.
const links = [
  ["/projects", "Projects"],
  ["/team", "Team"],
  ["/blog", "Blog"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/try-the-model", "Try the Model", true],
];

// variant: rise | fade | wipe | scale
export function Reveal({ children, variant = "rise", delay = 0, style, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`r r--${variant} ${inView ? "is-in" : ""}`}
      style={{ "--d": `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="nav">
        <div className="shell nav__inner">
          <Link to="/" className="mark">
            <span className="mark__dot" aria-hidden="true" />
            Black Box
          </Link>
          <nav className="nav__links" aria-label="Main">
            {links.map(([to, label, isCta]) => (
              <NavLink
                key={to}
                to={to}
                className={`nav__link${isCta ? " nav__link--cta" : ""}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  );
}
