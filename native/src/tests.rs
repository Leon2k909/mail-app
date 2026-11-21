use super::*;
use gpui::{Modifiers, TestAppContext, VisualTestContext};

fn open_preview(cx: &mut TestAppContext, empty: bool) -> (Entity<Mail>, &mut VisualTestContext) {
    cx.update(configure_mail);
    let cx = cx.add_empty_window();
    let view = cx.update(|window, cx| {
        let mail = cx.new(|cx| Mail::new(empty, window, cx));
        window.replace_root(cx, |window, cx| Root::new(mail.clone(), window, cx));
        mail
    });
    cx.simulate_resize(size(px(1220.), px(768.)));
    cx.run_until_parked();
    (view, cx)
}

fn click(selector: &'static str, cx: &mut VisualTestContext) {
    let bounds = cx
        .debug_bounds(selector)
        .unwrap_or_else(|| panic!("Expected visible control: {selector}"));
    cx.simulate_click(bounds.center(), Modifiers::none());
}

#[gpui::test]
fn search_and_read_mail_with_the_keyboard(cx: &mut TestAppContext) {
    let (view, cx) = open_preview(cx, false);
    cx.simulate_keystrokes("ctrl-f");
    cx.simulate_input("oWeN");
    cx.read(|cx| {
        assert_eq!(view.read(cx).search.read(cx).value().as_ref(), "oWeN");
        assert_eq!(view.read(cx).ids_in_view(cx), [1]);
    });

    cx.simulate_keystrokes("escape down");
    cx.read(|cx| {
        assert_eq!(view.read(cx).selected, Some(1));
        assert!(!view.read(cx).messages[1].unread);
    });

    click("folder-Sent", cx);
    cx.read(|cx| {
        assert!(view.read(cx).search.read(cx).value().is_empty());
        assert_eq!(view.read(cx).folder.title(), "Sent");
        assert_eq!(view.read(cx).selected, None);
        assert_eq!(view.read(cx).ids_in_view(cx).len(), 1);
    });
}

#[gpui::test]
fn unread_filter_and_archiving_work_across_folders(cx: &mut TestAppContext) {
    let (view, cx) = open_preview(cx, false);
    click("Unread", cx);
    cx.read(|cx| assert_eq!(view.read(cx).ids_in_view(cx), [1, 2, 4]));
    click("message-1", cx);
    cx.read(|cx| assert_eq!(view.read(cx).ids_in_view(cx), [2, 4]));
    click("mark-read", cx);
    cx.read(|cx| assert_eq!(view.read(cx).ids_in_view(cx), [1, 2, 4]));
    click("Archive", cx);
    cx.read(|cx| {
        assert_eq!(view.read(cx).folder.title(), "Inbox");
        assert_eq!(view.read(cx).messages[1].folder.title(), "Archive");
    });
    click("folder-Archive", cx);
    click("message-1", cx);
    click("Move to inbox", cx);
    cx.read(|cx| {
        assert_eq!(view.read(cx).messages[1].folder.title(), "Inbox");
        assert_eq!(view.read(cx).selected, None);
    });
}

#[gpui::test]
fn empty_mailbox_resizes_and_handles_navigation(cx: &mut TestAppContext) {
    let (view, cx) = open_preview(cx, true);
    cx.simulate_resize(size(px(940.), px(600.)));
    cx.simulate_keystrokes("down up");
    cx.read(|cx| {
        assert!(view.read(cx).ids_in_view(cx).is_empty());
        assert_eq!(view.read(cx).selected, None);
    });
    let list = cx
        .debug_bounds("folder-Inbox")
        .expect("Folder navigation is visible");
    assert!(list.size.width > px(0.) && list.size.height > px(0.));
}
