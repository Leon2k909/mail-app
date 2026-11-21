use gpui::{AssetSource, Result, SharedString};
use std::borrow::Cow;

pub struct MailIcons;

macro_rules! outline {
    ($path:literal) => {
        concat!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d=""##,
            $path,
            r#""/></svg>"#
        )
    };
}

impl AssetSource for MailIcons {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        let svg = match path {
            "mail" => outline!(
                "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1 8 6 8-6"
            ),
            "inbox" => outline!("M3 13 6 6h12l3 7v5H3v-5Zm0 0h6l1.5 2h3l1.5-2h6"),
            "file" => outline!("M6 3h8l4 4v14H6V3Zm7 0v5h5M9 13h6m-6 4h6"),
            "send" => outline!("M21 3 3 10l7 3 4 8 7-18ZM10 13 21 3"),
            "shield" => outline!("m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Zm0 5v4m0 3h.01"),
            "trash" => outline!("M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"),
            "archive" => outline!("M4 4h16v5H4V4Zm1 5v11h14V9m-9 4h4"),
            "search" => outline!("M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-2 4.5 4.5"),
            "reply" => outline!("m10 5-6 6 6 6m-6-6h10c4 0 6 2 6 6"),
            "close" | "icons/close.svg" => outline!("m6 6 12 12M6 18 18 6"),
            _ => return Ok(None),
        };
        Ok(Some(Cow::Borrowed(svg.as_bytes())))
    }

    fn list(&self, _: &str) -> Result<Vec<SharedString>> {
        Ok(Vec::new())
    }
}
