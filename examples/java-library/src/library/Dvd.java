package library;

public class Dvd extends Item {
    private int minutes;

    public Dvd(String title, int minutes) { super(title); this.minutes = minutes; }

    @Override
    public int loanDays() { return 7; }
}
