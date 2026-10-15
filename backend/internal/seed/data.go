package seed

// PersonSeed represents synthetic person data.
type PersonSeed struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Active bool   `json:"active"`
}

// TeamSeed represents synthetic team data.
type TeamSeed struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// SystemSeed represents synthetic system service data.
type SystemSeed struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Criticality int      `json:"criticality"` // 1 to 10
	Aliases     []string `json:"aliases"`
}

// DecisionSeed represents synthetic architectural decisions.
type DecisionSeed struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Summary  string   `json:"summary"`
	Date     string   `json:"date"`
	Status   string   `json:"status"` // "approved", "superseded", "proposed"
	Aliases  []string `json:"aliases"`
}

// TicketSeed represents Jira/issue tracker tickets.
type TicketSeed struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
}

// ThreadSeed represents Slack/discussion threads.
type ThreadSeed struct {
	ID      string `json:"id"`
	Channel string `json:"channel"`
	Excerpt string `json:"excerpt"`
	Body    string `json:"body"`
}

// DocumentSeed represents architectural summary documents / RFCs.
type DocumentSeed struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Text  string `json:"text"`
	URL   string `json:"url"`
}
