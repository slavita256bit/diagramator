package library;

/** Abstract base for everything on the shelves. */
public abstract class Item implements Borrowable {
    protected String title;
    protected Shelf shelf;              // association
    private Loan currentLoan;
    private static int count;

    protected Item(String title) { this.title = title; count++; }

    public boolean isAvailable() { return currentLoan == null; }
    public void checkOut(Member member) { currentLoan = new Loan(this, member); }
    public abstract int loanDays();
    public static int count() { return count; }
}
