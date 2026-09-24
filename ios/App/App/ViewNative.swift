import UIKit
import Capacitor
import EventKit
import EventKitUI

// App-specific native code for View.

/// SceneDelegate uses this instead of the stock CAPBridgeViewController so
/// the app's own (non-npm) plugins get registered with the bridge.
class ViewBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ViewCalendarPlugin())
    }
}

/// `ViewCalendar.addEvent({ title, notes, location, start, end, allDay })` —
/// shows the system "New Event" sheet prefilled with the event, so the user
/// picks the calendar and saves it. Replaces the .ics download used on the
/// website, which WKWebView can't hand off to the Calendar app.
@objc(ViewCalendarPlugin)
public class ViewCalendarPlugin: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate {
    public let identifier = "ViewCalendarPlugin"
    public let jsName = "ViewCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise)
    ]

    private let store = EKEventStore()
    private var pendingCall: CAPPluginCall?

    @objc func addEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"),
              let start = call.getDouble("start"),
              let end = call.getDouble("end") else {
            call.reject("title, start and end are required")
            return
        }

        let present = {
            DispatchQueue.main.async {
                let event = EKEvent(eventStore: self.store)
                event.title = title
                event.notes = call.getString("notes")
                event.location = call.getString("location")
                event.startDate = Date(timeIntervalSince1970: start / 1000)
                event.endDate = Date(timeIntervalSince1970: end / 1000)
                event.isAllDay = call.getBool("allDay") ?? false

                let editor = EKEventEditViewController()
                editor.eventStore = self.store
                editor.event = event
                editor.editViewDelegate = self
                self.pendingCall = call
                self.bridge?.viewController?.present(editor, animated: true)
            }
        }

        // iOS 17+ runs the editor out of process and needs no calendar
        // permission at all; older systems need access before saving.
        if #available(iOS 17.0, *) {
            present()
        } else {
            store.requestAccess(to: .event) { granted, _ in
                if granted { present() } else { call.reject("Calendar access denied") }
            }
        }
    }

    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated: true)
        pendingCall?.resolve(["saved": action == .saved])
        pendingCall = nil
    }
}
